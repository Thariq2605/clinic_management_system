from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (
    Appointment,
    Department,
    Doctor,
    Patient,
    Receptionist,
    Role,
    Specialization,
    Staff,
    User,
)


class CommonLoginAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Shared department and specialization
        self.dept = Department.objects.create(
            department_name="General Medicine",
            description="General care"
        )
        self.spec = Specialization.objects.create(
            specialization_name="General Practitioner"
        )

        # 1. Receptionist setup
        self.role_receptionist = Role.objects.create(role_name="Receptionist")
        self.user_receptionist = User.objects.create_user(
            username="reception_user",
            password="password123",
            role=self.role_receptionist,
            is_active=True
        )
        self.staff_receptionist = Staff.objects.create(
            user=self.user_receptionist,
            full_name="Sarah Connor",
            gender="Female",
            dob=date(1990, 5, 15),
            mobile_number="9876543210",
            email="sarah@clinic.test",
            department=self.dept
        )
        self.receptionist = Receptionist.objects.create(
            staff=self.staff_receptionist,
            is_active=True
        )

        # 2. Doctor setup
        self.role_doctor = Role.objects.create(role_name="doctor")
        self.user_doctor = User.objects.create_user(
            username="doctor_user",
            password="password123",
            role=self.role_doctor,
            is_active=True
        )
        self.staff_doctor = Staff.objects.create(
            user=self.user_doctor,
            full_name="Dr. Gregory House",
            gender="Male",
            dob=date(1975, 6, 11),
            mobile_number="9876543211",
            email="house@clinic.test",
            department=self.dept
        )
        self.doctor = Doctor.objects.create(
            staff=self.staff_doctor,
            specialization=self.spec,
            department=self.dept,
            consultation_fee=Decimal("150.00"),
            qualification="MD",
            experience_years=20,
            license_number="DOC-12345",
            is_active=True
        )

        # 3. Pharmacist setup
        self.role_pharmacist = Role.objects.create(role_name="Pharmacist")
        self.user_pharmacist = User.objects.create_user(
            username="pharma_user",
            password="password123",
            role=self.role_pharmacist,
            is_active=True
        )

        # 4. Inactive user setup
        self.user_inactive = User.objects.create_user(
            username="inactive_user",
            password="password123",
            role=self.role_receptionist,
            is_active=False
        )

        # 5. Unsupported role setup (Administrator)
        self.role_admin = Role.objects.create(role_name="Administrator")
        self.user_admin = User.objects.create_user(
            username="admin_user",
            password="password123",
            role=self.role_admin,
            is_active=True
        )

    # -----------------------------------------------------------
    # CSRF Endpoint
    # -----------------------------------------------------------
    def test_common_csrf_endpoint(self):
        response = self.client.get("/api/csrf/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrfToken", response.data)
        self.assertTrue(len(response.data["csrfToken"]) > 0)

    # -----------------------------------------------------------
    # A. Valid Receptionist Credentials
    # -----------------------------------------------------------
    def test_valid_receptionist_login(self):
        response = self.client.post("/api/login/", {
            "username": "reception_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "receptionist")
        self.assertEqual(response.data["user_id"], self.user_receptionist.user_id)
        self.assertEqual(response.data["receptionist_id"], self.receptionist.receptionist_id)
        self.assertEqual(response.data["name"], "Sarah Connor")
        self.assertEqual(response.data["redirect"], "dashboard.html")

        # Verify session variables set
        session = self.client.session
        self.assertEqual(session.get("user_id"), self.user_receptionist.user_id)
        self.assertEqual(session.get("receptionist_id"), self.receptionist.receptionist_id)

    # -----------------------------------------------------------
    # B. Valid Doctor Credentials
    # -----------------------------------------------------------
    def test_valid_doctor_login(self):
        response = self.client.post("/api/login/", {
            "username": "doctor_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "doctor")
        self.assertEqual(response.data["user_id"], self.user_doctor.user_id)
        self.assertEqual(response.data["doctor_id"], self.doctor.doctor_id)
        self.assertEqual(response.data["doctor_name"], "Dr. Gregory House")
        self.assertEqual(response.data["username"], "doctor_user")
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["redirect"], "doctor/dashboard.html")

        # Verify doctor session variables set as in doctor_login
        session = self.client.session
        self.assertEqual(session.get("user_id"), self.user_doctor.user_id)
        self.assertEqual(session.get("doctor_id"), self.doctor.doctor_id)

    # -----------------------------------------------------------
    # C. Valid Pharmacist Credentials
    # -----------------------------------------------------------
    def test_valid_pharmacist_login(self):
        response = self.client.post("/api/login/", {
            "username": "pharma_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "pharmacist")
        self.assertEqual(response.data["user_id"], self.user_pharmacist.user_id)
        self.assertEqual(response.data["username"], "pharma_user")
        self.assertEqual(response.data["redirect"], "pharmacist/index.html")

    # -----------------------------------------------------------
    # D. Invalid Username
    # -----------------------------------------------------------
    def test_invalid_username(self):
        response = self.client.post("/api/login/", {
            "username": "nonexistent_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.data)

    # -----------------------------------------------------------
    # E. Invalid Password
    # -----------------------------------------------------------
    def test_invalid_password(self):
        response = self.client.post("/api/login/", {
            "username": "reception_user",
            "password": "wrong_password"
        })
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.data)

    # -----------------------------------------------------------
    # F. Inactive User
    # -----------------------------------------------------------
    def test_inactive_user_rejected(self):
        response = self.client.post("/api/login/", {
            "username": "inactive_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 403)
        self.assertIn("error", response.data)

    # -----------------------------------------------------------
    # G. User with Unsupported Role
    # -----------------------------------------------------------
    def test_unsupported_role_rejected(self):
        response = self.client.post("/api/login/", {
            "username": "admin_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 403)
        self.assertIn("not supported", response.data["error"])

    # -----------------------------------------------------------
    # H. Missing Username
    # -----------------------------------------------------------
    def test_missing_username(self):
        response = self.client.post("/api/login/", {
            "password": "password123"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    # -----------------------------------------------------------
    # I. Missing Password
    # -----------------------------------------------------------
    def test_missing_password(self):
        response = self.client.post("/api/login/", {
            "username": "reception_user"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    # -----------------------------------------------------------
    # J. Client-sent role parameter is strictly ignored
    # -----------------------------------------------------------
    def test_client_cannot_spoof_role(self):
        # A receptionist tries to send "role": "doctor"
        response = self.client.post("/api/login/", {
            "username": "reception_user",
            "password": "password123",
            "role": "doctor"
        })
        self.assertEqual(response.status_code, 200)
        # Backend MUST ignore the client-sent "role" and return receptionist
        self.assertEqual(response.data["role"], "receptionist")
        self.assertEqual(response.data["redirect"], "dashboard.html")

    # -----------------------------------------------------------
    # K. Verify existing module APIs work after common login
    # -----------------------------------------------------------
    def test_receptionist_api_works_with_common_login_session(self):
        # Log in via common login
        login_resp = self.client.post("/api/login/", {
            "username": "reception_user",
            "password": "password123"
        })
        self.assertEqual(login_resp.status_code, 200)

        # Create a patient directly
        patient = Patient.objects.create(
            full_name="Test Patient",
            dob=date(2000, 1, 1),
            gender="Other",
            mobile_number="5550001",
            email="testpatient@clinic.test",
            address="Street 1",
            blood_group="A+",
            emergency_contact="5550002"
        )

        # Call receptionist protected API using the session
        resp = self.client.get(f"/api/receptionist/patients/?patient_id={patient.patient_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["full_name"], "Test Patient")

    def test_doctor_api_works_with_common_login_token(self):
        # Log in via common login
        login_resp = self.client.post("/api/login/", {
            "username": "doctor_user",
            "password": "password123"
        })
        self.assertEqual(login_resp.status_code, 200)
        access_token = login_resp.data["access"]

        # Call doctor protected API using Bearer JWT
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        resp = self.client.get(f"/doctor/appointments/{self.doctor.doctor_id}/")
        self.assertEqual(resp.status_code, 200)

    # -----------------------------------------------------------
    # L. Verify existing individual login endpoints still work
    # -----------------------------------------------------------
    def test_existing_receptionist_login_still_works(self):
        resp = self.client.post("/api/receptionist/login/", {
            "username": "reception_user",
            "password": "password123"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["receptionist_id"], self.receptionist.receptionist_id)

    def test_existing_doctor_login_still_works(self):
        resp = self.client.post("/doctor/login/", {
            "username": "doctor_user",
            "password": "password123"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_existing_pharmacist_login_still_works(self):
        resp = self.client.post("/pharmacist/login/", {
            "username": "pharma_user",
            "password": "password123"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["role"], "Pharmacist")

