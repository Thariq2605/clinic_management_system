from datetime import date, timedelta
from decimal import Decimal

from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone

from core.models import (
    Appointment,
    Bill,
    Consultation,
    Department,
    Doctor,
    Medicine,
    Patient,
    Prescription,
    PrescriptionMedicine,
    Receptionist,
    Role,
    Specialization,
    Staff,
    User,
)


class PharmacistSecurityTests(APITestCase):
    def setUp(self):
        self.pharmacist_role = Role.objects.create(role_name="Pharmacist")
        self.admin_role = Role.objects.create(role_name="Administrator")
        self.pharmacist = User.objects.create_user(
            username="pharmacist", password="test-password", role=self.pharmacist_role
        )
        self.admin = User.objects.create_user(
            username="administrator", password="test-password", role=self.admin_role
        )
        self.medicine = Medicine.objects.create(
            medicine_name="Test Medicine", manufacturer="Clinic", unit_price="2.50",
            quantity=5, expiry_date="2030-01-01", is_active=True
        )

        self.department = Department.objects.create(
            department_name="Test Clinic", description="Test data only"
        )
        self.pharmacist_staff = Staff.objects.create(
            user=self.pharmacist, full_name="Test Pharmacist", gender="Other",
            dob=date(1990, 1, 1), mobile_number="111",
            email="pharmacist@example.test", department=self.department,
        )

    def create_prescription(self, medicine=None, active=True):
        suffix = User.objects.count()
        doctor_role = Role.objects.create(role_name=f"Doctor {suffix}")
        doctor_user = User.objects.create_user(f"doctor-{suffix}", "test-password", role=doctor_role)
        doctor_staff = Staff.objects.create(
            user=doctor_user, full_name="Test Doctor", gender="Other",
            dob=date(1980, 1, 1), mobile_number="222",
            email=f"doctor-{suffix}@example.test", department=self.department,
        )
        doctor = Doctor.objects.create(
            staff=doctor_staff, specialization=Specialization.objects.create(
                specialization_name=f"General {suffix}"
            ), department=self.department, consultation_fee="50.00",
            qualification="MD", experience_years=10, license_number=f"LIC-{suffix}",
        )
        patient = Patient.objects.create(
            full_name="Test Patient", dob=date(2000, 1, 1), gender="Other",
            mobile_number=f"333{suffix}", email=f"patient-{suffix}@example.test",
            address="Test Road", blood_group="O+", emergency_contact="444",
        )
        receptionist_role = Role.objects.create(role_name=f"Receptionist {suffix}")
        receptionist_user = User.objects.create_user(
            f"receptionist-{suffix}", "test-password", role=receptionist_role
        )
        receptionist_staff = Staff.objects.create(
            user=receptionist_user, full_name="Test Receptionist", gender="Other",
            dob=date(1991, 1, 1), mobile_number="555",
            email=f"receptionist-{suffix}@example.test", department=self.department,
        )
        appointment = Appointment.objects.create(
            patient=patient, doctor=doctor,
            receptionist=Receptionist.objects.create(staff=receptionist_staff),
            appointment_date=timezone.localdate(), appointment_time="10:00",
            token_number=str(suffix), reason="Consultation", status="completed",
            payment_status="Pending", created_at=timezone.now(),
        )
        prescription = Prescription.objects.create(
            consultation=Consultation.objects.create(
                appointment=appointment, doctor=doctor, symptoms="Test",
                diagnosis="Test", notes="Test", consultation_date=timezone.localdate(),
            ),
            patient=patient, doctor=doctor,
            prescription_date=timezone.localdate(), is_active=active,
        )
        item = PrescriptionMedicine.objects.create(
            prescription=prescription, medicine=medicine or self.medicine,
            dosage="1 tablet", frequency="once daily", duration=5,
            instructions="Take after food",
        )
        bill = Bill.objects.create(
            patient=patient, appointment=appointment, total_amount="50.00",
            bill_date=timezone.localdate(), payment_status="pending",
            created_by=receptionist_staff,
        )
        return prescription, item, self.pharmacist_staff, bill

    def login_as(self, user):
        response = self.client.post("/pharmacist/login/", {
            "username": user.username, "password": "test-password"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def login_admin(self):
        response = self.client.post("/api/login/", {
            "username": self.admin.username, "password": "test-password"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "administrator")
        token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return response

    def test_pharmacist_login_returns_server_signed_jwt(self):
        response = self.login_as(self.pharmacist)
        self.assertEqual(response.data["role"], "Pharmacist")
        self.assertNotIn("password", response.data)
        self.assertEqual(self.client.get("/pharmacist/me/").data["user_id"], self.pharmacist.user_id)

    def test_invalid_fallback_password_is_rejected_without_changing_password(self):
        response = self.client.post("/pharmacist/login/", {
            "username": "pharmacist", "password": "Pharma 1234"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.pharmacist.refresh_from_db()
        self.assertTrue(self.pharmacist.check_password("test-password"))
        self.assertFalse(self.pharmacist.check_password("Pharma 1234"))

    def test_unauthenticated_requests_are_rejected(self):
        for url in ("/pharmacist/me/", "/pharmacist/medicines/", "/pharmacist/prescriptions/", "/pharmacist/prescription-medicines/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post("/pharmacist/medicines/", {}, format="json").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post("/pharmacist/prescription-medicines/1/dispense/", {}, format="json").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_pharmacist_cannot_access_pharmacist_endpoints(self):
        self.login_admin()
        for url in ("/pharmacist/me/", "/pharmacist/medicines/", "/pharmacist/prescriptions/", "/pharmacist/prescription-medicines/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post("/pharmacist/medicines/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post("/pharmacist/prescription-medicines/1/dispense/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)

    def test_pharmacist_can_access_pharmacist_data(self):
        self.login_as(self.pharmacist)
        self.assertEqual(self.client.get("/pharmacist/medicines/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/pharmacist/prescriptions/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/pharmacist/prescription-medicines/").status_code, status.HTTP_200_OK)

    def test_pharmacist_cannot_mutate_prescription_medicine_except_dispense_action(self):
        self.login_as(self.pharmacist)
        response = self.client.post("/pharmacist/prescription-medicines/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_inactive_role_cannot_access_pharmacist_api(self):
        self.login_as(self.pharmacist)
        self.pharmacist_role.is_active = False
        self.pharmacist_role.save(update_fields=["is_active"])
        self.assertEqual(self.client.get("/pharmacist/medicines/").status_code, status.HTTP_403_FORBIDDEN)

    def test_dispensing_blocks_unsafe_stock_and_repeat_dispense(self):
        self.login_as(self.pharmacist)
        for name, expiry, active in (
            ("Expired", timezone.localdate() - timedelta(days=1), True),
            ("Inactive", timezone.localdate() + timedelta(days=30), False),
        ):
            medicine = Medicine.objects.create(
                medicine_name=name, manufacturer="Clinic", unit_price="3.00",
                quantity=4, expiry_date=expiry, is_active=active,
            )
            _, item, _, _ = self.create_prescription(medicine=medicine)
            response = self.client.post(
                f"/pharmacist/prescription-medicines/{item.item_id}/dispense/", {}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            medicine.refresh_from_db()
            self.assertEqual(medicine.quantity, 4)

        _, item, _, _ = self.create_prescription()
        url = f"/pharmacist/prescription-medicines/{item.item_id}/dispense/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(url, {}, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        self.medicine.refresh_from_db()
        self.assertEqual(self.medicine.quantity, 4)

        _, inactive_item, _, _ = self.create_prescription(active=False)
        response = self.client.post(
            f"/pharmacist/prescription-medicines/{inactive_item.item_id}/dispense/", {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_medicine_delete_keeps_record_as_inactive(self):
        self.login_as(self.pharmacist)
        response = self.client.delete(f"/pharmacist/medicines/{self.medicine.pk}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.medicine.refresh_from_db()
        self.assertFalse(self.medicine.is_active)
        self.assertEqual(self.client.get("/pharmacist/medicines/").data, [])

    def test_pharmacy_billing_is_separate_and_duplicate_protected(self):
        self.login_as(self.pharmacist)
        prescription, item, pharmacist_staff, reception_bill = self.create_prescription()
        prescription_data = self.client.get("/pharmacist/prescriptions/").data[0]
        self.assertEqual(prescription_data["patient"], prescription.patient_id)
        self.assertEqual(prescription_data["doctor"], prescription.doctor_id)
        self.assertEqual(prescription_data["prescription_date"], str(prescription.prescription_date))

        url = f"/pharmacist/prescriptions/{prescription.pk}/bill/"
        incomplete = self.client.post(url, {}, format="json")
        self.assertEqual(incomplete.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("not fully dispensed", incomplete.data["detail"])

        item.is_active = False
        item.save(update_fields=["is_active"])

        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pharmacy_bill = Bill.objects.get(pk=response.data["bill_id"])
        self.assertEqual(pharmacy_bill.total_amount, Decimal("2.50"))
        self.assertEqual(pharmacy_bill.created_by, pharmacist_staff)
        reception_bill.refresh_from_db()
        self.assertEqual(reception_bill.total_amount, Decimal("50.00"))
        self.assertEqual(self.client.get("/pharmacist/bills/").data[0]["bill_id"], pharmacy_bill.pk)
        self.assertEqual(
            self.client.post(f"/pharmacist/bills/{reception_bill.pk}/pay/", {"payment_method": "cash"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.post(url, {}, format="json").status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Bill.objects.filter(created_by=pharmacist_staff, is_active=True).count(), 1)

    def test_payment_validates_method_and_prevents_duplicate_charge(self):
        self.login_as(self.pharmacist)
        prescription, item, _, _ = self.create_prescription()
        item.is_active = False
        item.save(update_fields=["is_active"])
        response = self.client.post(
            f"/pharmacist/prescriptions/{prescription.pk}/bill/", {}, format="json"
        )
        bill_id = response.data["bill_id"]
        url = f"/pharmacist/bills/{bill_id}/pay/"

        invalid = self.client.post(url, {"payment_method": "barter"}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        paid = self.client.post(
            url, {"payment_method": "upi", "transaction_reference": "TEST-123"}, format="json"
        )
        self.assertEqual(paid.status_code, status.HTTP_200_OK)
        self.assertEqual(paid.data["payment_status"], "paid")
        self.assertEqual(self.client.get("/pharmacist/payments/").data[0]["amount"], "2.50")
        self.assertEqual(self.client.post(url, {"payment_method": "cash"}, format="json").status_code,
                         status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(self.client.get("/pharmacist/payments/").data), 1)
