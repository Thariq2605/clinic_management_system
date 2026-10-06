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
        self.doctor_user = User.objects.create_user(username="doctor", password="secret", role=doctor_role, is_active=True)
        doctor_staff = Staff.objects.create(
            user=self.doctor_user, full_name="Dr One", gender="Other", dob=date(1980, 1, 1),
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
                "mobile_number": "9876543210", "email": "patient@example.com", "address": "Road",
                "blood_group": "O+", "emergency_contact": "9876543211"}
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
                                 self.appointment_data(patient, appointment_time="10:00:00"))
        other = self.make_patient(full_name="Patient Two", mobile_number="334",
                                  email="two@example.com")
        second = self.client.post("/api/receptionist/appointments/",
                                  self.appointment_data(other, appointment_time="10:30:00"))
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
        from rest_framework_simplejwt.tokens import RefreshToken
        doctor_token = str(RefreshToken.for_user(self.doctor_user).access_token)
        response = self.client.get(
            f"/doctor/appointments/{self.doctor.doctor_id}/{created.data['appointment_id']}/patient/",
            HTTP_AUTHORIZATION=f"Bearer {doctor_token}")
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

    def test_public_csrf_and_login_unauthenticated(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid_token")
        csrf_res = self.client.get("/api/receptionist/csrf/")
        self.assertEqual(csrf_res.status_code, 200)
        self.assertTrue("csrfToken" in csrf_res.data)
        login_res = self.client.post("/api/receptionist/login/",
                                     {"username": "desk", "password": "secret"})
        self.assertEqual(login_res.status_code, 200)
        self.client.credentials()

    def test_patient_update_and_validation(self):
        patient = self.make_patient()
        patch_res = self.client.patch(
            f"/api/receptionist/patients/{patient.patient_id}/",
            {"address": "New Address", "mobile_number": "9998887776"}
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data["address"], "New Address")
        self.assertEqual(patch_res.data["mobile_number"], "9998887776")

        future_dob = (timezone.localdate() + timedelta(days=1)).isoformat()
        bad_res = self.client.patch(
            f"/api/receptionist/patients/{patient.patient_id}/",
            {"dob": future_dob}
        )
        self.assertEqual(bad_res.status_code, 400)

        get_res = self.client.get(f"/api/receptionist/patients/{patient.patient_id}/")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.data["patient_id"], patient.patient_id)

    def test_patient_activation_and_deactivation(self):
        patient = self.make_patient()
        deactivate_res = self.client.patch(f"/api/receptionist/patients/{patient.patient_id}/status/")
        self.assertEqual(deactivate_res.status_code, 200)
        self.assertFalse(deactivate_res.data["is_active"])
        patient.refresh_from_db()
        self.assertFalse(patient.is_active)

        activate_res = self.client.patch(
            f"/api/receptionist/patients/{patient.patient_id}/status/",
            {"is_active": True}
        )
        self.assertEqual(activate_res.status_code, 200)
        self.assertTrue(activate_res.data["is_active"])
        patient.refresh_from_db()
        self.assertTrue(patient.is_active)

    def test_appointment_conflict_prevention(self):
        patient = self.make_patient()
        res1 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient))
        self.assertEqual(res1.status_code, 201)

        other_patient = self.make_patient(full_name="Patient Conflict", mobile_number="777", email="conflict@example.com")
        res2 = self.client.post("/api/receptionist/appointments/", self.appointment_data(other_patient))
        self.assertEqual(res2.status_code, 409)
        self.assertIn("Doctor is already booked", res2.data["error"])

        doctor2_user = User.objects.create_user(username="doctor2", password="secret", role=Role.objects.get(role_name="Doctor"), is_active=True)
        doctor2_staff = Staff.objects.create(
            user=doctor2_user, full_name="Dr Two", gender="Other", dob=date(1985, 1, 1),
            mobile_number="223", email="doctor2@example.com", department=self.department)
        doctor2 = Doctor.objects.create(
            staff=doctor2_staff, specialization=Specialization.objects.get(specialization_name="General"),
            department=self.department, consultation_fee=Decimal("60.00"),
            qualification="MD", experience_years=5, license_number="LIC-2")

        res3 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient, doctor_id=doctor2.doctor_id))
        self.assertEqual(res3.status_code, 409)
        self.assertIn("Patient already has an appointment", res3.data["error"])

    def test_appointment_detail_and_search_filters(self):
        patient = self.make_patient(full_name="Filter Test Patient")
        res = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient))
        self.assertEqual(res.status_code, 201)
        apt_id = res.data["appointment_id"]

        detail = self.client.get(f"/api/receptionist/appointments/{apt_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["patient_name"], "Filter Test Patient")
        self.assertIsNotNone(detail.data["billing_details"])

        f_doc = self.client.get(f"/api/receptionist/appointments/?doctor={self.doctor.doctor_id}")
        self.assertEqual(f_doc.status_code, 200)
        self.assertTrue(len(f_doc.data) >= 1)

        f_dept = self.client.get(f"/api/receptionist/appointments/?department={self.department.department_id}")
        self.assertEqual(f_dept.status_code, 200)
        self.assertTrue(len(f_dept.data) >= 1)

        f_status = self.client.get("/api/receptionist/appointments/?status=scheduled")
        self.assertEqual(f_status.status_code, 200)
        self.assertTrue(len(f_status.data) >= 1)

        f_search = self.client.get("/api/receptionist/appointments/?search=Filter")
        self.assertEqual(f_search.status_code, 200)
        self.assertEqual(len(f_search.data), 1)

    def test_payment_history_and_isolation(self):
        patient = self.make_patient()
        created = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient))
        apt_id = created.data["appointment_id"]

        self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/",
                         {"amount": "20.00", "payment_method": "cash"})
        self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/",
                         {"amount": "30.00", "payment_method": "card", "transaction_reference": "TXN-CARD-123"})

        history = self.client.get(f"/api/receptionist/appointments/{apt_id}/payments/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.data), 2)

        other_user = User.objects.create_user(username="desk_other", password="secret", role=self.role, is_active=True)
        other_staff = Staff.objects.create(
            user=other_user, full_name="Desk Other", gender="Other", dob=date(1992, 1, 1),
            mobile_number="115", email="desk_other@example.com", department=self.department)
        Receptionist.objects.create(staff=other_staff)
        self.client.post("/api/receptionist/logout/")
        self.client.post("/api/receptionist/login/", {"username": "desk_other", "password": "secret"})

        self.assertEqual(self.client.get(f"/api/receptionist/appointments/{apt_id}/payments/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/receptionist/appointments/{apt_id}/").status_code, 404)

    def test_doctor_jwt_authentication_verified(self):
        login_res = self.client.post("/doctor/login/", {"username": "doctor", "password": "secret"})
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("access", login_res.data)
        self.assertIn("refresh", login_res.data)

        dash_no_auth = self.client.get(f"/doctor/dashboard/{self.doctor.doctor_id}/")
        self.assertEqual(dash_no_auth.status_code, 401)

        dash_with_auth = self.client.get(
            f"/doctor/dashboard/{self.doctor.doctor_id}/",
            HTTP_AUTHORIZATION=f"Bearer {login_res.data['access']}"
        )
        self.assertEqual(dash_with_auth.status_code, 200)
        self.assertEqual(dash_with_auth.data["doctor"]["doctor_id"], self.doctor.doctor_id)

        appts_res = self.client.get(
            f"/doctor/appointments/{self.doctor.doctor_id}/",
            HTTP_AUTHORIZATION=f"Bearer {login_res.data['access']}"
        )
        self.assertEqual(appts_res.status_code, 200)

    # ===============================================================
    # COMPLETE PATIENT FIELD VALIDATION TESTS (1 - 25)
    # ===============================================================

    def test_01_valid_patient_creation(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data())
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["full_name"], "Patient One")
        self.assertEqual(resp.data["mobile_number"], "9876543210")

    def test_02_empty_name_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(full_name=""))
        self.assertEqual(resp.status_code, 400)

    def test_03_name_with_only_spaces_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(full_name="    "))
        self.assertEqual(resp.status_code, 400)

    def test_04_name_containing_invalid_numbers_and_symbols_rejected(self):
        for bad_name in ["Patient123", "@@@", "####", "12345"]:
            resp = self.client.post("/api/receptionist/patients/", self.patient_data(full_name=bad_name))
            self.assertEqual(resp.status_code, 400)

    def test_05_future_dob_rejected(self):
        future_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(dob=future_date))
        self.assertEqual(resp.status_code, 400)

    def test_06_invalid_gender_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(gender="UnknownGender"))
        self.assertEqual(resp.status_code, 400)

    def test_07_invalid_blood_group_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(blood_group="C+"))
        self.assertEqual(resp.status_code, 400)

    def test_08_10_digit_mobile_accepted(self):
        for valid_num in ["9876543210", "9495482621", "8087654321"]:
            data = self.patient_data(mobile_number=valid_num, email=f"{valid_num}@example.com")
            resp = self.client.post("/api/receptionist/patients/", data)
            self.assertEqual(resp.status_code, 201)

    def test_09_9_digit_mobile_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="987654321"))
        self.assertEqual(resp.status_code, 400)

    def test_10_11_digit_mobile_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="94954826211"))
        self.assertEqual(resp.status_code, 400)

    def test_11_mobile_containing_letters_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="98765abc10"))
        self.assertEqual(resp.status_code, 400)

    def test_12_mobile_containing_plus91_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="+919876543210"))
        self.assertEqual(resp.status_code, 400)

    def test_13_mobile_containing_spaces_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="98765 43210"))
        self.assertEqual(resp.status_code, 400)

    def test_14_mobile_containing_hyphen_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="98765-43210"))
        self.assertEqual(resp.status_code, 400)

    def test_15_valid_emergency_contact_accepted(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(emergency_contact="9876543212"))
        self.assertEqual(resp.status_code, 201)

    def test_16_invalid_emergency_contact_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(emergency_contact="0736ry621489"))
        self.assertEqual(resp.status_code, 400)

    def test_17_emergency_contact_with_letters_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(emergency_contact="abcdefghij"))
        self.assertEqual(resp.status_code, 400)

    def test_18_emergency_contact_with_9_digits_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(emergency_contact="987654321"))
        self.assertEqual(resp.status_code, 400)

    def test_19_emergency_contact_with_11_digits_rejected(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(emergency_contact="98765432101"))
        self.assertEqual(resp.status_code, 400)

    def test_20_valid_email_accepted(self):
        resp = self.client.post("/api/receptionist/patients/", self.patient_data(email="john.doe@example.com"))
        self.assertEqual(resp.status_code, 201)

    def test_21_invalid_email_rejected(self):
        for bad_email in ["john", "john@", "@gmail.com", "john@gmail", "john@@gmail.com"]:
            resp = self.client.post("/api/receptionist/patients/", self.patient_data(email=bad_email))
            self.assertEqual(resp.status_code, 400)

    def test_22_empty_required_address_rejected(self):
        for bad_addr in ["", "     "]:
            resp = self.client.post("/api/receptionist/patients/", self.patient_data(address=bad_addr))
            self.assertEqual(resp.status_code, 400)

    def test_23_duplicate_mobile_patient_rejected(self):
        first = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="9876543210", email="first@example.com"))
        self.assertEqual(first.status_code, 201)
        duplicate = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="9876543210", email="second@example.com"))
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("already exists", str(duplicate.data))

    def test_24_duplicate_email_allowed_if_mobile_unique(self):
        first = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="9876543210", email="shared@example.com"))
        self.assertEqual(first.status_code, 201)
        second = self.client.post("/api/receptionist/patients/", self.patient_data(mobile_number="9876543211", email="shared@example.com"))
        self.assertEqual(second.status_code, 201)

    def test_25_existing_patient_can_update_own_details_without_false_duplicate(self):
        patient = self.make_patient(mobile_number="9876543210")
        resp = self.client.patch(f"/api/receptionist/patients/{patient.patient_id}/", {
            "full_name": "Updated Name",
            "mobile_number": "9876543210"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["full_name"], "Updated Name")

    # ===============================================================
    # COMPLETE APPOINTMENT & DOCTOR VALIDATION TESTS (26 - 39)
    # ===============================================================

    def test_26_valid_appointment_accepted(self):
        patient = self.make_patient()
        resp = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient))
        self.assertEqual(resp.status_code, 201)
        self.assertIn("appointment_id", resp.data)

    def test_27_invalid_patient_id_rejected(self):
        patient = self.make_patient()
        data = self.appointment_data(patient, patient_id=999999)
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_28_invalid_doctor_id_rejected(self):
        patient = self.make_patient()
        data = self.appointment_data(patient, doctor_id=999999)
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_29_invalid_department_doctor_relationship_rejected(self):
        other_dept = Department.objects.create(department_name="Neurology", description="Neuro")
        patient = self.make_patient()
        data = self.appointment_data(patient, department_id=other_dept.department_id)
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_30_past_appointment_rejected(self):
        patient = self.make_patient()
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        data = self.appointment_data(patient, appointment_date=yesterday)
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_31_walk_in_today_accepted(self):
        patient = self.make_patient()
        today = timezone.localdate().isoformat()
        now = timezone.localtime()
        if now.hour == 23 and now.minute > 50:
            future_time = "23:59:00"
        else:
            future_time = (now + timedelta(minutes=5)).strftime("%H:%M:%S")
        data = self.appointment_data(patient, appointment_date=today, appointment_time=future_time, appointment_type="walk-in")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 201)

    def test_walk_in_today_past_time_rejected(self):
        patient = self.make_patient()
        today = timezone.localdate().isoformat()
        now = timezone.localtime()
        if now.hour == 0 and now.minute < 5:
            past_time = "00:00:00"
        else:
            past_time = (now - timedelta(minutes=5)).strftime("%H:%M:%S")
        data = self.appointment_data(patient, appointment_date=today, appointment_time=past_time, appointment_type="walk-in")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Walk-In appointment time cannot be in the past", str(resp.data))

    def test_walk_in_today_current_time_accepted(self):
        patient = self.make_patient()
        today = timezone.localdate().isoformat()
        curr_time = timezone.localtime().strftime("%H:%M:%S")
        data = self.appointment_data(patient, appointment_date=today, appointment_time=curr_time, appointment_type="walk-in")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 201)

    def test_pre_booking_today_rejected(self):
        patient = self.make_patient()
        today = timezone.localdate().isoformat()
        data = self.appointment_data(patient, appointment_date=today, appointment_type="pre_booking")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Pre-Booking is only available from tomorrow onwards", str(resp.data))

    def test_pre_booking_tomorrow_accepted(self):
        patient = self.make_patient()
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        data = self.appointment_data(patient, appointment_date=tomorrow, appointment_type="pre_booking")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 201)

    def test_pre_booking_day_10_accepted(self):
        patient = self.make_patient()
        day10 = (timezone.localdate() + timedelta(days=10)).isoformat()
        data = self.appointment_data(patient, appointment_date=day10, appointment_type="pre_booking")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 201)

    def test_pre_booking_day_11_rejected(self):
        patient = self.make_patient()
        day11 = (timezone.localdate() + timedelta(days=11)).isoformat()
        data = self.appointment_data(patient, appointment_date=day11, appointment_type="pre_booking")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Pre-Booking appointments can only be made up to 10 days in advance", str(resp.data))

    def test_32_walk_in_tomorrow_rejected(self):
        patient = self.make_patient()
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        data = self.appointment_data(patient, appointment_date=tomorrow, appointment_type="walk-in")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_33_walk_in_yesterday_rejected(self):
        patient = self.make_patient()
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        data = self.appointment_data(patient, appointment_date=yesterday, appointment_type="walk-in")
        resp = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp.status_code, 400)

    def test_34_same_patient_same_doctor_same_datetime_rejected(self):
        patient = self.make_patient()
        data = self.appointment_data(patient, appointment_time="11:00:00")
        resp1 = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp1.status_code, 201)
        resp2 = self.client.post("/api/receptionist/appointments/", data)
        self.assertEqual(resp2.status_code, 409)

    def test_35_same_doctor_same_datetime_rejected(self):
        patient1 = self.make_patient(mobile_number="9876543210")
        patient2 = self.make_patient(full_name="Patient Two", mobile_number="9876543211", email="two@example.com")
        data1 = self.appointment_data(patient1, appointment_time="11:30:00")
        data2 = self.appointment_data(patient2, appointment_time="11:30:00")
        resp1 = self.client.post("/api/receptionist/appointments/", data1)
        self.assertEqual(resp1.status_code, 201)
        resp2 = self.client.post("/api/receptionist/appointments/", data2)
        self.assertEqual(resp2.status_code, 409)

    def test_36_same_patient_different_doctor_same_datetime_rejected(self):
        doc2_user = User.objects.create_user(username="doctor2", password="secret", role=self.doctor_user.role, is_active=True)
        doc2_staff = Staff.objects.create(
            user=doc2_user, full_name="Dr Two", gender="Other", dob=date(1985, 1, 1),
            mobile_number="223", email="doctor2@example.com", department=self.department)
        doctor2 = Doctor.objects.create(
            staff=doc2_staff, specialization=self.doctor.specialization,
            department=self.department, consultation_fee=Decimal("60.00"),
            qualification="MD", experience_years=8, license_number="LIC-2")

        patient = self.make_patient()
        data1 = self.appointment_data(patient, doctor_id=self.doctor.doctor_id, appointment_time="14:00:00")
        data2 = self.appointment_data(patient, doctor_id=doctor2.doctor_id, appointment_time="14:00:00")
        resp1 = self.client.post("/api/receptionist/appointments/", data1)
        self.assertEqual(resp1.status_code, 201)
        resp2 = self.client.post("/api/receptionist/appointments/", data2)
        self.assertEqual(resp2.status_code, 409)

    def test_37_doctor_specific_token_numbering(self):
        doc2_user = User.objects.create_user(username="doctor_b", password="secret", role=self.doctor_user.role, is_active=True)
        doc2_staff = Staff.objects.create(
            user=doc2_user, full_name="Dr B", gender="Other", dob=date(1982, 1, 1),
            mobile_number="224", email="docb@example.com", department=self.department)
        doctor_b = Doctor.objects.create(
            staff=doc2_staff, specialization=self.doctor.specialization,
            department=self.department, consultation_fee=Decimal("70.00"),
            qualification="MD", experience_years=12, license_number="LIC-B")

        patient1 = self.make_patient(mobile_number="9876543210")
        patient2 = self.make_patient(full_name="Patient Two", mobile_number="9876543211", email="p2@example.com")

        # Doctor A appointments
        res_a1 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient1, doctor_id=self.doctor.doctor_id, appointment_time="10:00:00"))
        res_a2 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient2, doctor_id=self.doctor.doctor_id, appointment_time="10:30:00"))
        self.assertEqual(res_a1.data["token_number"], "1")
        self.assertEqual(res_a2.data["token_number"], "2")

        # Doctor B appointments on same day
        patient3 = self.make_patient(full_name="Patient Three", mobile_number="9876543212", email="p3@example.com")
        patient4 = self.make_patient(full_name="Patient Four", mobile_number="9876543213", email="p4@example.com")
        res_b1 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient3, doctor_id=doctor_b.doctor_id, appointment_time="10:00:00"))
        res_b2 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient4, doctor_id=doctor_b.doctor_id, appointment_time="10:30:00"))
        self.assertEqual(res_b1.data["token_number"], "1")
        self.assertEqual(res_b2.data["token_number"], "2")

    def test_38_token_numbering_resets_per_doctor_date(self):
        patient1 = self.make_patient(mobile_number="9876543210")
        day1 = (timezone.localdate() + timedelta(days=1)).isoformat()
        day2 = (timezone.localdate() + timedelta(days=2)).isoformat()

        res1 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient1, appointment_date=day1, appointment_time="10:00:00"))
        self.assertEqual(res1.data["token_number"], "1")

        res2 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient1, appointment_date=day2, appointment_time="10:00:00"))
        self.assertEqual(res2.data["token_number"], "1")

    def test_39_doctor_a_queue_does_not_block_doctor_b_queue(self):
        doc2_user = User.objects.create_user(username="doctor_c", password="secret", role=self.doctor_user.role, is_active=True)
        doc2_staff = Staff.objects.create(
            user=doc2_user, full_name="Dr C", gender="Other", dob=date(1983, 1, 1),
            mobile_number="225", email="docc@example.com", department=self.department)
        doctor_c = Doctor.objects.create(
            staff=doc2_staff, specialization=self.doctor.specialization,
            department=self.department, consultation_fee=Decimal("75.00"),
            qualification="MD", experience_years=9, license_number="LIC-C")

        patient1 = self.make_patient(mobile_number="9876543210")
        patient2 = self.make_patient(full_name="Patient Two", mobile_number="9876543211", email="p2@example.com")

        res_a = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient1, doctor_id=self.doctor.doctor_id, appointment_time="10:00:00"))
        self.assertEqual(res_a.status_code, 201)

        res_c = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient2, doctor_id=doctor_c.doctor_id, appointment_time="10:00:00"))
        self.assertEqual(res_c.status_code, 201)
        self.assertEqual(res_c.data["token_number"], "1")

    def test_payment_valid_modes(self):
        # 1. Valid Cash Payment (no transaction reference needed)
        patient1 = self.make_patient(full_name="Cash Patient", mobile_number="9876500001", email="cash@example.com")
        appt1 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient1, appointment_time="11:00:00"))
        apt_id1 = appt1.data["appointment_id"]

        cash_res = self.client.post(f"/api/receptionist/appointments/{apt_id1}/payments/", {
            "amount": "50.00",
            "payment_method": "cash"
        })
        self.assertEqual(cash_res.status_code, 201)
        self.assertEqual(cash_res.data["bill_payment_status"], "paid")
        self.assertEqual(cash_res.data["payment_method"], "cash")

        # 2. Valid Card Payment (with transaction reference)
        patient2 = self.make_patient(full_name="Card Patient", mobile_number="9876500002", email="card@example.com")
        appt2 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient2, appointment_time="11:30:00"))
        apt_id2 = appt2.data["appointment_id"]

        card_res = self.client.post(f"/api/receptionist/appointments/{apt_id2}/payments/", {
            "amount": "25.00",
            "payment_method": "card",
            "transaction_reference": "CARD-TXN-12345"
        })
        self.assertEqual(card_res.status_code, 201)
        self.assertEqual(card_res.data["bill_payment_status"], "partial")

        # 3. Valid UPI Payment (with transaction reference)
        upi_res = self.client.post(f"/api/receptionist/appointments/{apt_id2}/payments/", {
            "amount": "25.00",
            "payment_method": "upi",
            "transaction_reference": "UPI/987654321/REF"
        })
        self.assertEqual(upi_res.status_code, 201)
        self.assertEqual(upi_res.data["bill_payment_status"], "paid")

        # 4. Valid Online Payment (with transaction reference)
        patient3 = self.make_patient(full_name="Online Patient", mobile_number="9876500003", email="online@example.com")
        appt3 = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient3, appointment_time="12:00:00"))
        apt_id3 = appt3.data["appointment_id"]

        online_res = self.client.post(f"/api/receptionist/appointments/{apt_id3}/payments/", {
            "amount": "50.00",
            "payment_method": "online",
            "transaction_reference": "NET-BANK-REF-888"
        })
        self.assertEqual(online_res.status_code, 201)
        self.assertEqual(online_res.data["bill_payment_status"], "paid")

    def test_payment_validations(self):
        patient = self.make_patient(full_name="Val Patient", mobile_number="9876500004", email="val@example.com")
        appt = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient, appointment_time="12:30:00"))
        apt_id = appt.data["appointment_id"]

        # 1. Missing payment mode
        res_no_mode = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "20.00"
        })
        self.assertEqual(res_no_mode.status_code, 400)

        # 2. Zero payment
        res_zero = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "0.00",
            "payment_method": "cash"
        })
        self.assertEqual(res_zero.status_code, 400)

        # 3. Negative payment
        res_neg = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "-10.00",
            "payment_method": "cash"
        })
        self.assertEqual(res_neg.status_code, 400)

        # 4. Amount greater than balance
        res_over = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "100.00",
            "payment_method": "cash"
        })
        self.assertEqual(res_over.status_code, 400)

        # 5. Card without reference
        res_card_noref = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "20.00",
            "payment_method": "card"
        })
        self.assertEqual(res_card_noref.status_code, 400)

        # 6. UPI without reference
        res_upi_noref = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "20.00",
            "payment_method": "upi"
        })
        self.assertEqual(res_upi_noref.status_code, 400)

        # 7. Online without reference
        res_online_noref = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "20.00",
            "payment_method": "online"
        })
        self.assertEqual(res_online_noref.status_code, 400)

        # Valid payment to complete bill
        self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "50.00",
            "payment_method": "cash"
        })

        # 8. Payment after fully paid
        res_already_paid = self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "10.00",
            "payment_method": "cash"
        })
        self.assertEqual(res_already_paid.status_code, 400)

    def test_token_queue_workflow(self):
        today = timezone.localdate()
        now = timezone.localtime()
        if now.hour == 23 and now.minute > 50:
            future_time = now.strftime("%H:%M:%S")
            future_time2 = "23:59:59"
        else:
            future_time = (now + timedelta(minutes=2)).strftime("%H:%M:%S")
            future_time2 = (now + timedelta(minutes=5)).strftime("%H:%M:%S")

        patient_q1 = self.make_patient(full_name="Queue Patient One", mobile_number="9876500005", email="q1@example.com")
        patient_q2 = self.make_patient(full_name="Queue Patient Two", mobile_number="9876500006", email="q2@example.com")

        # Create 2 appointments for today
        appt1 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": patient_q1.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor.doctor_id, "appointment_date": today.isoformat(),
            "appointment_time": future_time, "appointment_type": "walk_in", "reason": "Fever check"
        })
        self.assertEqual(appt1.status_code, 201)
        token1 = appt1.data["token_number"]

        appt2 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": patient_q2.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor.doctor_id, "appointment_date": today.isoformat(),
            "appointment_time": future_time2, "appointment_type": "walk_in", "reason": "Headache check"
        })
        self.assertEqual(appt2.status_code, 201)
        token2 = appt2.data["token_number"]

        # Tokens are generated sequentially and no duplicates
        self.assertNotEqual(token1, token2)

        # 1. Fetch Today's Queue
        queue_res = self.client.get("/api/receptionist/token-queue/today/")
        self.assertEqual(queue_res.status_code, 200)
        self.assertEqual(queue_res.data["waiting_count"], 2)
        self.assertIsNone(queue_res.data["now_serving"])

        # 2. Call Next
        call_res = self.client.post("/api/receptionist/token-queue/call-next/", {})
        self.assertEqual(call_res.status_code, 200)
        self.assertIsNotNone(call_res.data["now_serving"])
        serving_id = call_res.data["now_serving"]["appointment_id"]
        self.assertEqual(call_res.data["now_serving"]["token_number"], token1)

        # 3. Cannot call another token while one is already serving
        conflict_res = self.client.post("/api/receptionist/token-queue/call-next/", {})
        self.assertEqual(conflict_res.status_code, 409)

        # 4. Cannot complete an invalid token ID
        invalid_comp = self.client.post("/api/receptionist/token-queue/999999/complete/", {})
        self.assertEqual(invalid_comp.status_code, 404)

        # 5. Complete current serving token
        comp_res = self.client.post(f"/api/receptionist/token-queue/{serving_id}/complete/", {})
        self.assertEqual(comp_res.status_code, 200)
        self.assertEqual(comp_res.data["completed"]["status"], "completed")

        # 6. Cannot complete already completed token
        already_comp = self.client.post(f"/api/receptionist/token-queue/{serving_id}/complete/", {})
        self.assertEqual(already_comp.status_code, 400)

        # 7. Call next patient in line (token2)
        call_res2 = self.client.post("/api/receptionist/token-queue/call-next/", {})
        self.assertEqual(call_res2.status_code, 200)
        self.assertEqual(call_res2.data["now_serving"]["token_number"], token2)

        # Complete token2
        serving_id2 = call_res2.data["now_serving"]["appointment_id"]
        self.client.post(f"/api/receptionist/token-queue/{serving_id2}/complete/", {})

        # 8. Empty queue: call next returns clean 200 with "No patients waiting."
        empty_res = self.client.post("/api/receptionist/token-queue/call-next/", {})
        self.assertEqual(empty_res.status_code, 200)
        self.assertIn("No patients waiting", empty_res.data["message"])
        self.assertIsNone(empty_res.data["now_serving"])

    def test_printable_bill_receipt_details(self):
        patient = self.make_patient(full_name="Print Patient", mobile_number="9876500007", email="print@example.com")
        appt = self.client.post("/api/receptionist/appointments/", self.appointment_data(patient, appointment_time="14:00:00"))
        apt_id = appt.data["appointment_id"]

        # Record a payment
        self.client.post(f"/api/receptionist/appointments/{apt_id}/payments/", {
            "amount": "50.00",
            "payment_method": "card",
            "transaction_reference": "REC-PRINT-999"
        })

        # Fetch bills
        bills_res = self.client.get("/api/receptionist/bills/")
        self.assertEqual(bills_res.status_code, 200)
        self.assertTrue(len(bills_res.data) > 0)
        bill_id = bills_res.data[0]["bill_id"]

        # Fetch bill detail for printing
        detail_res = self.client.get(f"/api/receptionist/bills/{bill_id}/")
        self.assertEqual(detail_res.status_code, 200)
        data = detail_res.data

        # Verify all print document fields:
        # MEDICARE branding
        self.assertEqual(data["clinic"]["name"], "MEDICARE")
        self.assertEqual(data["clinic"]["subtitle"], "CLINIC MANAGEMENT SYSTEM")
        # Bill Number
        self.assertIn("BILL-", data["bill_number"])
        # Patient
        self.assertEqual(data["patient_name"], "Print Patient")
        # Bill Type
        self.assertEqual(data["bill_type"], "Consultation Fee")
        # Bill Amount, Paid Amount, Balance
        self.assertEqual(Decimal(data["total_amount"]), Decimal("50.00"))
        self.assertEqual(Decimal(data["paid_amount"]), Decimal("50.00"))
        self.assertEqual(Decimal(data["outstanding_balance"]), Decimal("0.00"))
        # Payment Status
        self.assertEqual(data["payment_status"], "paid")
        # Payment Mode & Transaction ID in payments list
        self.assertEqual(len(data["payments"]), 1)
        self.assertEqual(data["payments"][0]["payment_method"], "card")
        self.assertEqual(data["payments"][0]["transaction_reference"], "REC-PRINT-999")

    def test_call_next_and_complete_doctor_isolation(self):
        today = timezone.localdate()

        # Create Doctor B
        doc_b_user = User.objects.create_user(username="doctor_c_iso", password="secret", role=Role.objects.get(role_name="Doctor"), is_active=True)
        doc_b_staff = Staff.objects.create(
            user=doc_b_user, full_name="Dr Chitra", gender="Female", dob=date(1985, 3, 3),
            mobile_number="9876500099", email="doc_c@example.com", department=self.department)
        doctor_b = Doctor.objects.create(
            staff=doc_b_staff, specialization=self.doctor.specialization,
            department=self.department, consultation_fee=Decimal("55.00"),
            qualification="MBBS", experience_years=5, license_number="LIC-DOC-C")

        p_a1 = self.make_patient(full_name="Queue DocA 1", mobile_number="9876500031", email="qa1@example.com")
        p_a2 = self.make_patient(full_name="Queue DocA 2", mobile_number="9876500032", email="qa2@example.com")
        p_b1 = self.make_patient(full_name="Queue DocB 1", mobile_number="9876500033", email="qb1@example.com")

        # Create appointments for today
        now = timezone.localtime()
        if now.hour == 23 and now.minute > 50:
            time_a1 = now.strftime("%H:%M:%S")
            time_a2 = "23:59:59"
        else:
            time_a1 = (now + timedelta(minutes=2)).strftime("%H:%M:%S")
            time_a2 = (now + timedelta(minutes=5)).strftime("%H:%M:%S")
        time_b1 = time_a1

        res_a1 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p_a1.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor.doctor_id, "appointment_date": today.isoformat(),
            "appointment_time": time_a1, "appointment_type": "walk_in", "reason": "Walk-in QA1"
        })
        res_a2 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p_a2.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor.doctor_id, "appointment_date": today.isoformat(),
            "appointment_time": time_a2, "appointment_type": "walk_in", "reason": "Walk-in QA2"
        })
        res_b1 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p_b1.patient_id, "department_id": self.department.department_id,
            "doctor_id": doctor_b.doctor_id, "appointment_date": today.isoformat(),
            "appointment_time": time_b1, "appointment_type": "walk_in", "reason": "Walk-in QB1"
        })
        self.assertEqual(res_a1.status_code, 201)
        self.assertEqual(res_a2.status_code, 201)
        self.assertEqual(res_b1.status_code, 201)

        # Call Next for Doctor A calls Token 1
        res_call_a = self.client.post("/api/receptionist/token-queue/call-next/", {
            "doctor_id": self.doctor.doctor_id
        })
        self.assertEqual(res_call_a.status_code, 200)
        self.assertEqual(res_call_a.data["now_serving"]["token_number"], "1")
        self.assertEqual(res_call_a.data["now_serving"]["appointment_id"], res_a1.data["appointment_id"])

        # Calling next for Doctor A while Token 1 is serving returns 409
        res_call_a_again = self.client.post("/api/receptionist/token-queue/call-next/", {
            "doctor_id": self.doctor.doctor_id
        })
        self.assertEqual(res_call_a_again.status_code, 409)

        # Doctor B calling next is NOT blocked by Doctor A serving!
        res_call_b = self.client.post("/api/receptionist/token-queue/call-next/", {
            "doctor_id": doctor_b.doctor_id
        })
        self.assertEqual(res_call_b.status_code, 200)
        self.assertEqual(res_call_b.data["now_serving"]["token_number"], "1")
        self.assertEqual(res_call_b.data["now_serving"]["appointment_id"], res_b1.data["appointment_id"])

        # Complete Token 1 for Doctor A
        res_complete_a = self.client.post(f"/api/receptionist/token-queue/{res_a1.data['appointment_id']}/complete/")
        self.assertEqual(res_complete_a.status_code, 200)
        self.assertEqual(res_complete_a.data["completed"]["status"], "completed")

        # Now Doctor A can call next (gets Token 2)
        res_call_a2 = self.client.post("/api/receptionist/token-queue/call-next/", {
            "doctor_id": self.doctor.doctor_id
        })
        self.assertEqual(res_call_a2.status_code, 200)
        self.assertEqual(res_call_a2.data["now_serving"]["token_number"], "2")
        self.assertEqual(res_call_a2.data["now_serving"]["appointment_id"], res_a2.data["appointment_id"])


@override_settings(ROOT_URLCONF="receptionistapp.tests")
class DoctorWorkingHoursValidationTests(TestCase):
    """
    Test suite for Doctor Working-Hours Validation for Appointment Booking.
    Verifies that appointments are strictly constrained within a doctor's
    configured working-hour window for both Walk-In and Pre-Booking.
    """

    def setUp(self):
        from datetime import time
        from receptionistapp.services import DOCTOR_WORKING_HOURS

        self.client = APIClient()
        self.department = Department.objects.create(department_name="General", description="Care")
        self.role = Role.objects.create(role_name="Receptionist")
        self.user = User.objects.create_user(username="desk_wh", password="secret", role=self.role, is_active=True)
        self.staff = Staff.objects.create(
            user=self.user, full_name="Desk WH", gender="Other", dob=date(1990, 1, 1),
            mobile_number="1119998881", email="desk_wh@example.com", department=self.department)
        self.receptionist = Receptionist.objects.create(staff=self.staff)

        doctor_role = Role.objects.create(role_name="Doctor")

        # Doctor A: 08:00 AM -> 08:00 PM (12-hour period)
        user_a = User.objects.create_user(username="doc_a", password="secret", role=doctor_role, is_active=True)
        staff_a = Staff.objects.create(
            user=user_a, full_name="Dr. Thariq", gender="Male", dob=date(1985, 1, 1),
            mobile_number="2220001111", email="thariq@example.com", department=self.department)
        self.doctor_a = Doctor.objects.create(
            staff=staff_a, specialization=Specialization.objects.create(specialization_name="General Care"),
            department=self.department, consultation_fee=Decimal("100.00"),
            qualification="MBBS", experience_years=8, license_number="LIC-A")
        DOCTOR_WORKING_HOURS[self.doctor_a.doctor_id] = (time(8, 0), time(20, 0))

        # Doctor B: 10:00 AM -> 06:00 PM (18:00)
        user_b = User.objects.create_user(username="doc_b", password="secret", role=doctor_role, is_active=True)
        staff_b = Staff.objects.create(
            user=user_b, full_name="Dr. Anu", gender="Female", dob=date(1990, 5, 5),
            mobile_number="2220002222", email="anu@example.com", department=self.department)
        self.doctor_b = Doctor.objects.create(
            staff=staff_b, specialization=Specialization.objects.create(specialization_name="Pediatrics Spec"),
            department=self.department, consultation_fee=Decimal("150.00"),
            qualification="MD", experience_years=5, license_number="LIC-B")
        DOCTOR_WORKING_HOURS[self.doctor_b.doctor_id] = (time(10, 0), time(18, 0))

        self.client.post("/api/receptionist/login/", {"username": "desk_wh", "password": "secret"})
        self.tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        self.today = timezone.localdate().isoformat()

    def make_patient(self, name="WH Patient", phone="9876543299"):
        return Patient.objects.create(
            full_name=name, dob=date(1995, 1, 1), gender="Male",
            mobile_number=phone, email=f"{phone}@example.com", address="Street",
            blood_group="B+", emergency_contact="9876543200", is_active=True
        )

    def test_1_appointment_before_doctor_start_time_rejected(self):
        """1. Appointment before doctor's start time -> 400"""
        p = self.make_patient("Patient Early", "9876540001")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "07:59:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("working hours", str(res.data))
        self.assertIn("08:00 AM - 08:00 PM", str(res.data))

    def test_2_appointment_exactly_at_doctor_start_time_accepted(self):
        """2. Appointment exactly at doctor's start time -> accepted (201)"""
        p = self.make_patient("Patient Start", "9876540002")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "08:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["appointment_time"], "08:00:00")

    def test_3_appointment_during_working_hours_accepted(self):
        """3. Appointment during working hours -> accepted (201)"""
        p = self.make_patient("Patient Midday", "9876540003")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "12:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 201)

    def test_4_appointment_exactly_at_doctor_end_time_accepted(self):
        """4. Appointment exactly at doctor's end time -> accepted if end is inclusive (201)"""
        p = self.make_patient("Patient End", "9876540004")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "20:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["appointment_time"], "20:00:00")

    def test_5_appointment_after_doctor_end_time_rejected(self):
        """5. Appointment after doctor's end time -> 400"""
        p = self.make_patient("Patient Late", "9876540005")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "20:01:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("working hours", str(res.data))
        self.assertIn("08:00 AM - 08:00 PM", str(res.data))

    def test_6_different_doctor_with_different_working_hours_correctly_validated(self):
        """6. Different doctor (Doctor B: 10:00 -> 18:00) -> correctly validated"""
        p1 = self.make_patient("Patient B1", "9876540011")
        p2 = self.make_patient("Patient B2", "9876540012")
        p3 = self.make_patient("Patient B3", "9876540013")
        p4 = self.make_patient("Patient B4", "9876540014")
        p5 = self.make_patient("Patient B5", "9876540015")

        # 09:59 -> REJECT (before 10:00)
        r_0959 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p1.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "09:59:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r_0959.status_code, 400)
        self.assertIn("10:00 AM - 06:00 PM", str(r_0959.data))

        # 10:00 -> ACCEPT (exact start)
        r_1000 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p2.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "10:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r_1000.status_code, 201)

        # 15:00 -> ACCEPT (during hours)
        r_1500 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p3.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "15:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r_1500.status_code, 201)

        # 18:00 -> ACCEPT (exact end)
        r_1800 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p4.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "18:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r_1800.status_code, 201)

        # 18:01 -> REJECT (after 18:00)
        r_1801 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p5.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "18:01:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r_1801.status_code, 400)
        self.assertIn("10:00 AM - 06:00 PM", str(r_1801.data))

    def test_7_walk_in_outside_doctor_hours_rejected(self):
        """7. Walk-In + outside doctor's hours -> 400"""
        p1 = self.make_patient("WalkIn Early", "9876540021")
        p2 = self.make_patient("WalkIn Late", "9876540022")

        # Early: 07:30 (before 08:00)
        r_early = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p1.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.today,
            "appointment_time": "07:30:00", "appointment_type": "walk_in", "reason": "Urgent"
        })
        self.assertEqual(r_early.status_code, 400)
        self.assertTrue("working hours" in str(r_early.data) or "past" in str(r_early.data))

        # Late: 20:30 (after 20:00)
        r_late = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p2.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_a.doctor_id, "appointment_date": self.today,
            "appointment_time": "20:30:00", "appointment_type": "walk_in", "reason": "Urgent"
        })
        self.assertEqual(r_late.status_code, 400)
        self.assertIn("working hours", str(r_late.data))

    def test_8_walk_in_inside_doctor_hours_future_time_accepted(self):
        """8. Walk-In + inside doctor's hours + current/future time -> accepted (201)"""
        from datetime import time
        from receptionistapp.services import DOCTOR_WORKING_HOURS

        now = timezone.localtime()
        # Doctor with working hours that guarantee coverage of current/future time
        user_c = User.objects.create_user(username="doc_c", password="secret", role=Role.objects.get(role_name="Doctor"), is_active=True)
        staff_c = Staff.objects.create(
            user=user_c, full_name="Dr. Coverage", gender="Male", dob=date(1980, 1, 1),
            mobile_number="2220003333", email="coverage@example.com", department=self.department)
        doc_c = Doctor.objects.create(
            staff=staff_c, specialization=Specialization.objects.first(),
            department=self.department, consultation_fee=Decimal("120.00"),
            qualification="MBBS", experience_years=10, license_number="LIC-C")
        DOCTOR_WORKING_HOURS[doc_c.doctor_id] = (time(0, 0), time(23, 59))

        future_time = (now + timedelta(minutes=5)).strftime("%H:%M:%S")
        p = self.make_patient("WalkIn Valid", "9876540023")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": doc_c.doctor_id, "appointment_date": self.today,
            "appointment_time": future_time, "appointment_type": "walk_in", "reason": "Valid walk-in"
        })
        self.assertEqual(res.status_code, 201)

    def test_9_pre_booking_outside_doctor_hours_rejected(self):
        """9. Pre-Booking + outside doctor's hours -> 400"""
        p1 = self.make_patient("PreBook Out1", "9876540031")
        p2 = self.make_patient("PreBook Out2", "9876540032")

        # Doctor B (10:00 - 18:00)
        # 07:00 -> before start
        r1 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p1.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "07:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r1.status_code, 400)
        self.assertIn("working hours", str(r1.data))

        # 21:00 -> after end
        r2 = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p2.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "21:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(r2.status_code, 400)
        self.assertIn("working hours", str(r2.data))

    def test_10_pre_booking_inside_doctor_hours_accepted(self):
        """10. Pre-Booking + inside doctor's hours -> accepted (201)"""
        p = self.make_patient("PreBook In", "9876540033")
        res = self.client.post("/api/receptionist/appointments/", {
            "patient_id": p.patient_id, "department_id": self.department.department_id,
            "doctor_id": self.doctor_b.doctor_id, "appointment_date": self.tomorrow,
            "appointment_time": "14:00:00", "appointment_type": "pre_booking", "reason": "Checkup"
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["appointment_time"], "14:00:00")
