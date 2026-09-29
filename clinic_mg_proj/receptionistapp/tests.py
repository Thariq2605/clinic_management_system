from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (Appointment, Bill, Department, Doctor, Patient,
                         Receptionist, Role, Specialization, Staff, User)

app_name = "receptionist_test"
urlpatterns = [path("api/receptionist/", include("receptionistapp.urls")), path("doctor/", include("doctorapp.urls"))]


@override_settings(ROOT_URLCONF="receptionistapp.tests")
class ReceptionistAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(department_name="General", description="Care")
        self.role = Role.objects.create(role_name="Receptionist")
        self.user = User.objects.create_user(username="desk", password="secret", role=self.role, is_active=True)
        self.staff = Staff.objects.create(
            user=self.user, full_name="Desk", gender="Other", dob=date(1990, 1, 1),
            mobile_number="111", email="desk@example.com", department=self.department)
        self.receptionist = Receptionist.objects.create(staff=self.staff)
        doctor_role = Role.objects.create(role_name="Doctor")
        doctor_user = User.objects.create_user(username="doctor", password="secret", role=doctor_role, is_active=True)
        doctor_staff = Staff.objects.create(
            user=doctor_user, full_name="Dr One", gender="Other", dob=date(1980, 1, 1),
            mobile_number="222", email="doctor@example.com", department=self.department)
        self.doctor = Doctor.objects.create(
            staff=doctor_staff, specialization=Specialization.objects.create(
                specialization_name="General"),
            department=self.department, consultation_fee=Decimal("50.00"),
            qualification="MD", experience_years=10, license_number="LIC-1")
        self.when = timezone.localdate() + timedelta(days=1)
        self.client.post("/api/receptionist/login/",
                         {"username": "desk", "password": "secret"})

    def patient_data(self, **changes):
        data = {"full_name": "Patient One", "dob": "2000-01-01", "gender": "Other",
                "mobile_number": "333", "email": "patient@example.com", "address": "Road",
                "blood_group": "O+", "emergency_contact": "444"}
        data.update(changes)
        return data

    def make_patient(self, **changes):
        data = self.patient_data(**changes)
        data["dob"] = date.fromisoformat(data["dob"])
        return Patient.objects.create(**data)

    def appointment_data(self, patient, **changes):
        data = {"patient_id": patient.patient_id, "department_id": self.department.department_id,
                "doctor_id": self.doctor.doctor_id, "appointment_date": self.when.isoformat(),
                "appointment_time": "10:00:00", "reason": "Consultation"}
        data.update(changes)
        return data

    def test_authentication_and_non_receptionist_rejection(self):
        self.assertEqual(self.client.session["receptionist_id"], self.receptionist.receptionist_id)
        self.client.post("/api/receptionist/logout/")
        self.assertEqual(self.client.get("/api/receptionist/departments/").status_code, 401)
        response = self.client.post("/api/receptionist/login/",
                                    {"username": "doctor", "password": "secret"})
        self.assertEqual(response.status_code, 403)

    def test_patient_registration_validation_duplicate_and_search(self):
        created = self.client.post("/api/receptionist/patients/", self.patient_data())
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data["patient_id"])
        self.assertEqual(self.client.post("/api/receptionist/patients/",
                                          self.patient_data()).status_code, 409)
        self.assertEqual(self.client.get("/api/receptionist/patients/?search=Patient").status_code, 200)
        self.assertEqual(self.client.post("/api/receptionist/patients/",
                                          {"full_name": "Incomplete"}).status_code, 400)

    def test_department_doctor_filter_and_consultation_fee(self):
        self.assertEqual(self.client.get("/api/receptionist/departments/").status_code, 200)
        result = self.client.get(
            f"/api/receptionist/doctors/?department={self.department.department_id}")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data[0]["consultation_fee"], "50.00")

    def test_availability_endpoint_reports_missing_schedule_support(self):
        result = self.client.get(
            f"/api/receptionist/doctors/{self.doctor.doctor_id}/availability/")
        self.assertFalse(result.data["availability_supported"])

    def test_appointment_token_bill_and_payment_status(self):
        patient = self.make_patient()
        result = self.client.post("/api/receptionist/appointments/",
                                  self.appointment_data(patient))
        self.assertEqual(result.status_code, 201)
        appointment = Appointment.objects.get(pk=result.data["appointment_id"])
        bill = Bill.objects.get(appointment=appointment)
        self.assertEqual((appointment.token_number, bill.total_amount), ("1", Decimal("50.00")))
        payment = self.client.post(
            f"/api/receptionist/appointments/{appointment.appointment_id}/payments/",
            {"amount": "50.00", "payment_method": "cash"})
        self.assertEqual(payment.status_code, 201)
        appointment.refresh_from_db()
        bill.refresh_from_db()
        self.assertEqual((bill.payment_status, appointment.payment_status), ("paid", "Paid"))

    def test_existing_patient_and_sequential_token_generation(self):
        patient = self.make_patient()
        first = self.client.post("/api/receptionist/appointments/",
                                 self.appointment_data(patient))
        other = self.make_patient(full_name="Patient Two", mobile_number="334",
                                  email="two@example.com")
        second = self.client.post("/api/receptionist/appointments/",
                                  self.appointment_data(other))
        self.assertEqual((first.data["token_number"], second.data["token_number"]), ("1", "2"))
        self.assertEqual(Patient.objects.count(), 2)

    def test_department_mismatch_is_rejected(self):
        patient = self.make_patient()
        other = Department.objects.create(department_name="Other", description="Other")
        response = self.client.post("/api/receptionist/appointments/",
                                    self.appointment_data(patient, department_id=other.department_id))
        self.assertEqual(response.status_code, 400)

    def test_receptionist_scoping_for_cancel_and_payment(self):
        patient = self.make_patient()
        created = self.client.post("/api/receptionist/appointments/",
                                   self.appointment_data(patient))
        other_user = User.objects.create_user(username="desk2", password="secret", role=self.role, is_active=True)
        other_staff = Staff.objects.create(
            user=other_user, full_name="Desk Two", gender="Other", dob=date(1991, 1, 1),
            mobile_number="112", email="desk2@example.com", department=self.department)
        Receptionist.objects.create(staff=other_staff)
        self.client.post("/api/receptionist/logout/")
        self.client.post("/api/receptionist/login/",
                         {"username": "desk2", "password": "secret"})
        appointment_id = created.data["appointment_id"]
        self.assertEqual(self.client.patch(
            f"/api/receptionist/appointments/{appointment_id}/").status_code, 404)
        self.assertEqual(self.client.post(
            f"/api/receptionist/appointments/{appointment_id}/payments/",
            {"amount": "1.00", "payment_method": "cash"}).status_code, 404)

    def test_cancelled_token_is_not_reused(self):
        patient = self.make_patient()
        first = self.client.post("/api/receptionist/appointments/",
                                 self.appointment_data(patient))
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.client.patch(
            f"/api/receptionist/appointments/{first.data['appointment_id']}/").status_code, 200)
        second_patient = self.make_patient(full_name="Patient Two", mobile_number="334",
                                           email="two@example.com")
        second = self.client.post("/api/receptionist/appointments/",
                                  self.appointment_data(second_patient))
        self.assertEqual(second.data["token_number"], "2")

    def test_payment_compatibility_with_doctor_patient_api(self):
        patient = self.make_patient()
        created = self.client.post("/api/receptionist/appointments/",
                                   self.appointment_data(patient))
        self.assertEqual(created.status_code, 201)
        payment = self.client.post(
            f"/api/receptionist/appointments/{created.data['appointment_id']}/payments/",
            {"amount": "50.00", "payment_method": "cash"})
        self.assertEqual(payment.status_code, 201)
        response = self.client.get(
            f"/doctor/appointments/{self.doctor.doctor_id}/{created.data['appointment_id']}/patient/")
        self.assertEqual(response.status_code, 200)
    def test_admin_pharmacist_and_lab_roles_are_rejected(self):
        for index, role_name in enumerate(("Admin", "Pharmacist", "Lab Technician")):
            role = Role.objects.create(role_name=role_name)
            User.objects.create_user(username=f"other{index}", password="secret",
                                     role=role, is_active=True)
            response = self.client.post("/api/receptionist/login/",
                                        {"username": f"other{index}", "password": "secret"})
            self.assertEqual(response.status_code, 403)

    def test_invalid_doctor_and_past_appointment_are_rejected(self):
        patient = self.make_patient()
        bad_doctor = self.client.post(
            "/api/receptionist/appointments/",
            self.appointment_data(patient, doctor_id=99999))
        self.assertEqual(bad_doctor.status_code, 400)
        past = self.client.post(
            "/api/receptionist/appointments/",
            self.appointment_data(patient,
                                  appointment_date=(timezone.localdate() - timedelta(days=1)).isoformat()))
        self.assertEqual(past.status_code, 400)

    def test_partial_payment_and_overpayment_validation(self):
        patient = self.make_patient()
        created = self.client.post("/api/receptionist/appointments/",
                                   self.appointment_data(patient))
        endpoint = f"/api/receptionist/appointments/{created.data['appointment_id']}/payments/"
        partial = self.client.post(endpoint, {"amount": "20.00", "payment_method": "cash"})
        self.assertEqual(partial.status_code, 201)
        self.assertEqual(partial.data["bill_payment_status"], "partial")
        over = self.client.post(endpoint, {"amount": "40.00", "payment_method": "cash"})
        self.assertEqual(over.status_code, 400)