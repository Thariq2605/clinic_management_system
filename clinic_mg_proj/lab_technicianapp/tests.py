from datetime import date, time
from decimal import Decimal

from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.test import APIClient

from core.models import (
    Appointment, Consultation, Department, Doctor, LabOrder, LabOrderItem,
    LabTechnician, LabTest, Patient, Prescription, PrescriptionLabTest,
    Receptionist, Role, Specialization, Staff, User,
)
from core.views import common_login

app_name = "lab_technician_test"
urlpatterns = [
    path("api/lab-technician/", include("lab_technicianapp.urls")),
    path("api/receptionist/", include("receptionistapp.urls")),
    path("api/login/", common_login),
]


@override_settings(ROOT_URLCONF="lab_technicianapp.tests")
class LabTechnicianResultTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(department_name="Lab", description="Tests")
        doctor_role = Role.objects.create(role_name="Doctor")
        doctor_user = User.objects.create_user(username="doctor-lab", password="secret", role=doctor_role)
        doctor_staff = Staff.objects.create(
            user=doctor_user, full_name="Dr Lab", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000010001", email="doctor-lab@example.test", department=self.department,
        )
        self.doctor = Doctor.objects.create(
            staff=doctor_staff, specialization=Specialization.objects.create(specialization_name="Lab"),
            department=self.department, consultation_fee=Decimal("50.00"), qualification="MD",
            experience_years=4, license_number="LAB-DOCTOR",
        )
        patient = Patient.objects.create(
            full_name="Lab Patient", dob=date(2000, 1, 1), gender="Other", mobile_number="9000010002",
            email="lab-patient@example.test", address="Clinic", blood_group="O+",
            emergency_contact="9000010003",
        )
        receptionist_role = Role.objects.create(role_name="Receptionist")
        receptionist_user = User.objects.create_user(username="desk-lab", password="secret", role=receptionist_role)
        receptionist_staff = Staff.objects.create(
            user=receptionist_user, full_name="Desk", gender="Other", dob=date(1990, 1, 1),
            mobile_number="9000010004", email="desk-lab@example.test", department=self.department,
        )
        receptionist = Receptionist.objects.create(staff=receptionist_staff)
        self.receptionist_user = receptionist_user
        appointment = Appointment.objects.create(
            patient=patient, doctor=self.doctor, receptionist=receptionist,
            appointment_date=date(2026, 10, 27), appointment_time=time(10), token_number="1",
            reason="Lab test", status="scheduled", payment_status="Paid", created_at="2026-10-26T00:00:00Z",
        )
        self.order = LabOrder.objects.create(
            patient=patient, doctor=self.doctor, appointment=appointment,
            order_date=appointment.appointment_date, priority="normal", status="pending",
        )
        self.test = LabTest.objects.create(
            test_name="Blood panel", test_type="blood", description="Panel",
            test_fee=Decimal("20.00"), normal_range="n/a",
        )
        self.technicians = []
        for username in ("tech-one", "tech-two"):
            role = Role.objects.create(role_name="Laboratory Technician")
            user = User.objects.create_user(username=username, password="secret", role=role)
            staff = Staff.objects.create(
                user=user, full_name=username, gender="Other", dob=date(1990, 1, 1),
                mobile_number=f"90000100{len(self.technicians) + 5}", email=f"{username}@example.test",
                department=self.department,
            )
            self.technicians.append((user, LabTechnician.objects.create(staff=staff)))
        self.item = LabOrderItem.objects.create(
            order=self.order, test=self.test, technician=self.technicians[0][1], status="pending",
        )

    def test_assigned_technician_can_save_and_update_one_text_result(self):
        self.client.force_authenticate(user=self.technicians[0][0])
        listed = self.client.get("/api/lab-technician/orders/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([row["item_id"] for row in listed.data], [self.item.item_id])

        saved = self.client.patch(
            f"/api/lab-technician/items/{self.item.item_id}/result/", {"result": "  Within range  "}, format="json"
        )
        self.assertEqual(saved.status_code, 200)
        self.item.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual((self.item.result, self.item.status, self.order.status), ("Within range", "completed", "completed"))

        updated = self.client.put(
            f"/api/lab-technician/items/{self.item.item_id}/result/", {"result": "Updated result"}, format="json"
        )
        self.assertEqual(updated.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.result, "Updated result")

    def test_unassigned_technician_and_other_role_cannot_access_or_write_results(self):
        self.client.force_authenticate(user=self.technicians[1][0])
        self.assertEqual(self.client.get("/api/lab-technician/orders/").data, [])
        self.assertEqual(self.client.patch(
            f"/api/lab-technician/items/{self.item.item_id}/result/", {"result": "No access"}, format="json"
        ).status_code, 404)

        doctor_user = User.objects.get(username="doctor-lab")
        self.client.force_authenticate(user=doctor_user)
        self.assertEqual(self.client.get("/api/lab-technician/orders/").status_code, 403)

    def test_empty_result_is_rejected(self):
        self.client.force_authenticate(user=self.technicians[0][0])
        response = self.client.patch(
            f"/api/lab-technician/items/{self.item.item_id}/result/", {"result": "  "}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_common_login_issues_technician_token_for_supported_role(self):
        user = self.technicians[0][0]
        login = self.client.post("/api/login/", {"username": user.username, "password": "secret"}, format="json")
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data["role"], "lab_technician")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.get("/api/lab-technician/orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["item_id"] for row in response.data], [self.item.item_id])

    def test_receptionist_assigns_requested_test_with_patient_doctor_and_appointment_links(self):
        consultation = Consultation.objects.create(
            appointment=self.order.appointment, doctor=self.doctor,
            symptoms="Test", diagnosis="Test", notes="", consultation_date=date(2026, 10, 27),
        )
        prescription = Prescription.objects.create(
            consultation=consultation, patient=self.order.patient, doctor=self.doctor,
            prescription_date=date(2026, 10, 27),
        )
        request = PrescriptionLabTest.objects.create(
            prescription=prescription, test=self.test, instructions="Fasting", is_active=True,
        )
        receptionist_client = APIClient()
        login = receptionist_client.post(
            "/api/receptionist/login/", {"username": self.receptionist_user.username, "password": "secret"},
        )
        self.assertEqual(login.status_code, 200)
        assigned = receptionist_client.post("/api/receptionist/lab-requests/assign/", {
            "prescription_lab_test_ids": [request.prescription_lab_test_id],
            "technician_id": self.technicians[0][1].technician_id,
            "priority": "urgent",
        }, format="json")
        self.assertEqual(assigned.status_code, 201)
        item = LabOrderItem.objects.get(prescription_lab_test=request)
        self.assertEqual((item.technician_id, item.test_id, item.status),
                         (self.technicians[0][1].technician_id, self.test.test_id, "pending"))
        self.assertEqual((item.order.patient_id, item.order.doctor_id, item.order.appointment_id,
                          item.order.priority),
                         (self.order.patient_id, self.doctor.doctor_id, self.order.appointment_id, "urgent"))
        duplicate = receptionist_client.post("/api/receptionist/lab-requests/assign/", {
            "prescription_lab_test_ids": [request.prescription_lab_test_id],
            "technician_id": self.technicians[0][1].technician_id, "priority": "normal",
        }, format="json")
        self.assertEqual(duplicate.status_code, 409)
