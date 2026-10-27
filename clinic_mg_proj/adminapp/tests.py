from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Department, Doctor, DoctorAvailability, Role, Specialization, Staff, User
from .serializers import (
    ClinicSettingSerializer, DoctorAvailabilitySerializer, DoctorSerializer, LabTestSerializer,
    MedicineSerializer, PatientSerializer, StaffSerializer, UserSerializer,
)


class AdminFinancialReadOnlyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_role = Role.objects.create(role_name="Administrator")
        self.admin = User.objects.create_user(
            username="admin-test", password="test-password", role=self.admin_role
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_read_appointment_bill_and_payment_lists(self):
        for url in ("/api/admin/appointments/", "/api/admin/bills/", "/api/admin/payments/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

    def test_admin_financial_and_appointment_writes_are_rejected(self):
        collections = ("appointments", "bills", "payments")
        for resource in collections:
            with self.subTest(resource=resource, method="POST"):
                self.assertEqual(
                    self.client.post(f"/api/admin/{resource}/", {}, format="json").status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )
            for method in ("put", "patch", "delete"):
                with self.subTest(resource=resource, method=method):
                    response = getattr(self.client, method)(
                        f"/api/admin/{resource}/999999/", {}, format="json"
                    )
                    self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_non_admin_cannot_read_financial_or_appointment_lists(self):
        receptionist_role = Role.objects.create(role_name="Receptionist")
        receptionist = User.objects.create_user(
            username="reception-test", password="test-password", role=receptionist_role
        )
        self.client.force_authenticate(user=receptionist)
        for url in ("/api/admin/appointments/", "/api/admin/bills/", "/api/admin/payments/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)


class AdminDoctorAvailabilityTests(TestCase):
    def setUp(self):
        department = Department.objects.create(department_name="General", description="Care")
        role = Role.objects.create(role_name="Doctor")
        user = User.objects.create_user(username="schedule-doctor", password="secret", role=role)
        staff = Staff.objects.create(
            user=user, full_name="Dr Schedule", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090001", email="schedule-doctor@example.test", department=department,
        )
        self.doctor = Doctor.objects.create(
            staff=staff, specialization=Specialization.objects.create(specialization_name="General"),
            department=department, consultation_fee=Decimal("50.00"), qualification="MD",
            experience_years=10, license_number="SCHEDULE-1",
        )
        admin = User.objects.create_user(
            username="schedule-admin", password="secret", role=Role.objects.create(role_name="Administrator")
        )
        self.client = APIClient()
        self.client.force_authenticate(user=admin)

    def test_admin_can_create_nonoverlapping_recurring_intervals(self):
        first = self.client.post("/api/admin/doctor-availability/", {
            "doctor": self.doctor.doctor_id, "weekday": 0,
            "start_time": "08:00", "end_time": "12:00", "is_active": True,
        }, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post("/api/admin/doctor-availability/", {
            "doctor": self.doctor.doctor_id, "weekday": 0,
            "start_time": "13:00", "end_time": "17:00", "is_active": True,
        }, format="json")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        overlap = self.client.post("/api/admin/doctor-availability/", {
            "doctor": self.doctor.doctor_id, "weekday": 0,
            "start_time": "11:00", "end_time": "14:00", "is_active": True,
        }, format="json")
        self.assertEqual(overlap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(DoctorAvailability.objects.filter(doctor=self.doctor).count(), 2)

    def test_schedule_changes_require_administrator_permission(self):
        self.client.force_authenticate(user=User.objects.create_user(
            username="schedule-reception", password="secret",
            role=Role.objects.create(role_name="Receptionist"),
        ))
        response = self.client.post("/api/admin/doctor-availability/", {
            "doctor": self.doctor.doctor_id, "weekday": 0,
            "start_time": "08:00", "end_time": "12:00", "is_active": True,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminSerializerValidationTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(department_name="General", description="Care")
        self.role = Role.objects.create(role_name="Doctor")
        self.specialization = Specialization.objects.create(specialization_name="General")
        self.staff_user = User.objects.create_user(username="validation-doctor", password="safe-test-pass", role=self.role)
        self.staff = Staff.objects.create(
            user=self.staff_user, full_name="Dr Test", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090001", email="doctor@example.test", department=self.department,
        )
        self.doctor = Doctor.objects.create(
            staff=self.staff, department=self.department, specialization=self.specialization,
            consultation_fee=Decimal("50.00"), qualification="MD", experience_years=10, license_number="LIC-TEST",
        )
        self.patient_data = {
            "full_name": "  Zoë O’Connor-Smith  ", "dob": "1990-01-01", "gender": "Other",
            "mobile_number": "6123456789", "email": "person@example.test", "address": "Clinic Road",
            "blood_group": "O+", "emergency_contact": "7123456789", "is_active": True,
        }

    def test_patient_accepts_supported_mobile_prefixes_and_unicode_names(self):
        for prefix in "6789":
            data = {**self.patient_data, "mobile_number": f"{prefix}123456789"}
            serializer = PatientSerializer(data=data)
            self.assertTrue(serializer.is_valid(), serializer.errors)
        normalized = PatientSerializer(data=self.patient_data)
        self.assertTrue(normalized.is_valid(), normalized.errors)
        self.assertEqual(normalized.validated_data["full_name"], "Zoë O’Connor-Smith")

    def test_patient_rejects_bad_mobile_values_email_and_future_birth_date(self):
        bad_values = ["123456789", "61234567890", "5123456789", "61234a6789", "61234 6789", "61234-6789"]
        for value in bad_values:
            with self.subTest(mobile=value):
                serializer = PatientSerializer(data={**self.patient_data, "mobile_number": value})
                self.assertFalse(serializer.is_valid())
                self.assertIn("mobile_number", serializer.errors)
        for data, field in (
            ({**self.patient_data, "email": "invalid-email"}, "email"),
            ({**self.patient_data, "dob": "2099-01-01"}, "dob"),
            ({**self.patient_data, "emergency_contact": "1234567890"}, "emergency_contact"),
            ({**self.patient_data, "full_name": "   "}, "full_name"),
        ):
            serializer = PatientSerializer(data=data)
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

    def test_user_account_requires_password_and_rejects_duplicate_username(self):
        missing_password = UserSerializer(data={"username": "new-user", "role": self.role.role_id})
        self.assertFalse(missing_password.is_valid())
        self.assertIn("password", missing_password.errors)
        duplicate = UserSerializer(data={"username": self.staff_user.username, "role": self.role.role_id, "password": "pass"})
        self.assertFalse(duplicate.is_valid())
        self.assertIn("username", duplicate.errors)

    def test_staff_creation_requires_credentials_and_password_is_never_defaulted(self):
        payload = {
            "username": "created-staff", "password": "chosen-password", "role": self.role.role_id,
            "full_name": "  Dr New  ", "gender": "Other", "dob": "1990-01-01",
            "mobile_number": "8123456789", "email": "new@example.test", "department": self.department.department_id,
        }
        serializer = StaffSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        created = serializer.save()
        self.assertEqual(created.full_name, "Dr New")
        self.assertTrue(created.user.check_password("chosen-password"))
        self.assertFalse(created.user.check_password("Admin@123"))
        missing_payload = {**payload, "username": "staff-without-password"}
        missing = StaffSerializer(data={key: value for key, value in missing_payload.items() if key != "password"})
        self.assertFalse(missing.is_valid())
        self.assertIn("password", missing.errors)

    def test_staff_update_allows_omitted_password_and_rejects_invalid_mobile(self):
        serializer = StaffSerializer(self.staff, data={"full_name": "Updated Name"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.save().full_name, "Updated Name")
        invalid = StaffSerializer(self.staff, data={"mobile_number": "5123456789"}, partial=True)
        self.assertFalse(invalid.is_valid())
        self.assertIn("mobile_number", invalid.errors)

    def test_doctor_medicine_and_lab_amounts_are_nonnegative_and_integer_fields_are_whole(self):
        doctor_data = {
            "staff": self.staff.staff_id, "department": self.department.department_id,
            "specialization": self.specialization.specialization_id, "consultation_fee": "10.00",
            "qualification": "MD", "experience_years": 2, "license_number": "LIC-1", "is_active": True,
        }
        valid_doctor = DoctorSerializer(data=doctor_data)
        self.assertTrue(valid_doctor.is_valid(), valid_doctor.errors)
        invalid_doctor = DoctorSerializer(data={**doctor_data, "consultation_fee": "-1"})
        self.assertFalse(invalid_doctor.is_valid())
        invalid_experience = DoctorSerializer(data={**doctor_data, "experience_years": -1})
        self.assertFalse(invalid_experience.is_valid())

        medicine_data = {"medicine_name": "Medicine", "manufacturer": "Maker", "unit_price": "1.25", "quantity": 2, "expiry_date": "2030-01-01", "is_active": True}
        self.assertTrue(MedicineSerializer(data=medicine_data).is_valid())
        for updates, field in (({"unit_price": "-0.01"}, "unit_price"), ({"quantity": -1}, "quantity")):
            serializer = MedicineSerializer(data={**medicine_data, **updates})
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

        lab_data = {"test_name": "Blood test", "test_type": "blood", "description": "Panel", "test_fee": "5.00", "normal_range": "Normal", "is_active": True}
        self.assertTrue(LabTestSerializer(data=lab_data).is_valid())
        lab_data["test_fee"] = "-5"
        invalid_lab = LabTestSerializer(data=lab_data)
        self.assertFalse(invalid_lab.is_valid())
        self.assertIn("test_fee", invalid_lab.errors)

    def test_availability_rejects_invalid_time_interval(self):
        serializer = DoctorAvailabilitySerializer(data={
            "doctor": self.doctor.doctor_id, "weekday": 0, "start_time": "14:00", "end_time": "13:00", "is_active": True,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("end_time", serializer.errors)

    def test_settings_validate_email_and_positive_integer_duration(self):
        for data, field in (
            ({"clinic_email": "invalid"}, "clinic_email"),
            ({"appointment_slot_duration": 0}, "appointment_slot_duration"),
            ({"appointment_slot_duration": -5}, "appointment_slot_duration"),
        ):
            serializer = ClinicSettingSerializer(data=data, partial=True)
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)
