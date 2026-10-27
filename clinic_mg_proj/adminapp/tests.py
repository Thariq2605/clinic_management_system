from datetime import date
from decimal import Decimal

from django.contrib.auth import authenticate
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import ValidationError
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

    def test_doctor_creation_endpoint_creates_one_linked_account_and_profile(self):
        payload = {
            "username": "api-created-doctor", "password": "Mango!River82",
            "full_name": "Dr API Created", "gender": "Other", "dob": "1990-01-01",
            "account_email": "api-doctor@example.test", "account_mobile_number": "8123456788",
            "department": self.doctor.department_id, "specialization": self.doctor.specialization_id,
            "consultation_fee": "75.00", "qualification": "MD", "experience_years": 4,
            "license_number": "API-LIC-NEW", "is_active": True,
        }
        created = self.client.post("/api/admin/doctors/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        linked_staff = Staff.objects.get(staff_id=created.data["staff"])
        self.assertTrue(linked_staff.user.check_password(payload["password"]))
        self.assertEqual(Doctor.objects.filter(staff=linked_staff).count(), 1)
        retry = self.client.post("/api/admin/doctors/", payload, format="json")
        self.assertEqual(retry.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.filter(username=payload["username"]).count(), 1)
        self.assertEqual(Staff.objects.filter(user=linked_staff.user).count(), 1)
        self.assertEqual(Doctor.objects.filter(staff=linked_staff).count(), 1)

    def test_existing_staff_cannot_receive_a_second_doctor_profile_via_api(self):
        linked_staff = Staff.objects.create(
            user=User.objects.create_user(
                username="existing-doctor-staff", password="secret", role=self.doctor.staff.user.role,
            ),
            full_name="Dr Existing Staff", gender="Other", dob=date(1985, 1, 1),
            mobile_number="9000090002", email="existing-doctor@example.test",
            department=self.doctor.department,
        )
        payload = {
            "staff": linked_staff.staff_id, "department": self.doctor.department_id,
            "specialization": self.doctor.specialization_id, "consultation_fee": "75.00",
            "qualification": "MD", "experience_years": 4, "license_number": "EXISTING-LIC",
        }
        created = self.client.post("/api/admin/doctors/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        duplicate = self.client.post("/api/admin/doctors/", payload, format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Doctor.objects.filter(staff=linked_staff).count(), 1)

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

    def test_admin_can_edit_and_deactivate_availability_but_cannot_delete_it(self):
        created = self.client.post("/api/admin/doctor-availability/", {
            "doctor": self.doctor.doctor_id, "weekday": 2,
            "start_time": "09:00", "end_time": "12:00", "is_active": True,
        }, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        availability_id = created.data["availability_id"]
        updated = self.client.patch(f"/api/admin/doctor-availability/{availability_id}/", {
            "start_time": "10:00", "is_active": False,
        }, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["start_time"], "10:00:00")
        self.assertFalse(updated.data["is_active"])
        self.assertEqual(self.client.delete(f"/api/admin/doctor-availability/{availability_id}/").status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


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
        case_variant = UserSerializer(data={"username": self.staff_user.username.upper(), "role": self.role.role_id, "password": "pass"})
        self.assertFalse(case_variant.is_valid())
        self.assertIn("username", case_variant.errors)

    def test_user_password_is_hashed_and_authentication_uses_only_the_selected_password(self):
        serializer = UserSerializer(data={
            "username": "secure-created-user", "role": self.role.role_id, "password": "chosen-user-password",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        created = serializer.save()
        self.assertNotEqual(created.password, "chosen-user-password")
        self.assertTrue(created.check_password("chosen-user-password"))
        self.assertIsNotNone(authenticate(username="secure-created-user", password="chosen-user-password"))
        self.assertIsNone(authenticate(username="secure-created-user", password="wrong-password"))
        for password in ("", "   "):
            invalid = UserSerializer(data={"username": f"invalid-{len(password)}", "role": self.role.role_id, "password": password})
            self.assertFalse(invalid.is_valid())
            self.assertIn("password", invalid.errors)
        for password in ("short", "password", "12345678"):
            invalid = UserSerializer(data={"username": f"invalid-policy-{len(password)}", "role": self.role.role_id, "password": password})
            self.assertFalse(invalid.is_valid())
            self.assertIn("password", invalid.errors)

    def test_user_update_without_password_preserves_existing_hash_and_blank_password_is_not_saved(self):
        original = self.staff_user.password
        for password in (None, ""):
            payload = {"username": "validation-doctor-updated"}
            if password is not None:
                payload["password"] = password
            serializer = UserSerializer(self.staff_user, data=payload, partial=True)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.save().password, original)
        invalid = UserSerializer(self.staff_user, data={"password": "   "}, partial=True)
        self.assertFalse(invalid.is_valid())
        self.assertIn("password", invalid.errors)

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
        self.assertIsNotNone(authenticate(username="created-staff", password="chosen-password"))
        self.assertFalse(created.user.check_password("Admin@123"))
        missing_payload = {**payload, "username": "staff-without-password"}
        missing = StaffSerializer(data={key: value for key, value in missing_payload.items() if key != "password"})
        self.assertFalse(missing.is_valid())
        self.assertIn("password", missing.errors)
        for password in ("", "   "):
            invalid = StaffSerializer(data={**payload, "username": f"invalid-staff-{len(password)}", "password": password})
            self.assertFalse(invalid.is_valid())
            self.assertIn("password", invalid.errors)
        too_short = StaffSerializer(data={**payload, "username": "short-staff-password", "password": "short"})
        self.assertFalse(too_short.is_valid())
        self.assertIn("password", too_short.errors)

    def test_staff_password_update_can_be_omitted_or_blank_without_changing_hash(self):
        original = self.staff.user.password
        for password in (None, ""):
            payload = {"full_name": "Staff Profile Update"}
            if password is not None:
                payload["password"] = password
            serializer = StaffSerializer(self.staff, data=payload, partial=True)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.save().user.password, original)

    def test_doctor_account_creation_is_atomic_role_safe_and_password_hashed(self):
        payload = {
            "username": "new-doctor-account", "password": "S!x-Purple-Kite-9284",
            "full_name": "Dr New Account", "gender": "Other", "dob": "1990-01-01",
            "account_email": "new-doctor@example.test", "account_mobile_number": "8123456789",
            "department": self.department.department_id, "specialization": self.specialization.specialization_id,
            "consultation_fee": "75.00", "qualification": "MD", "experience_years": 4,
            "license_number": "LIC-NEW", "is_active": True,
        }
        serializer = DoctorSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        created = serializer.save()
        created.staff.user.refresh_from_db()
        self.assertEqual(created.staff.user.role.role_name, "Doctor")
        self.assertEqual(created.staff.department_id, created.department_id)
        self.assertTrue(created.staff.user.check_password("S!x-Purple-Kite-9284"))
        self.assertNotEqual(created.staff.user.password, "S!x-Purple-Kite-9284")
        self.assertFalse(created.staff.user.check_password("Admin@123"))
        self.assertIsNotNone(authenticate(username="new-doctor-account", password="S!x-Purple-Kite-9284"))
        self.assertIsNone(authenticate(username="new-doctor-account", password="incorrect"))

    def test_doctor_account_creation_requires_profile_fields_and_department(self):
        payload = {
            "username": "incomplete-doctor", "password": "chosen-password", "full_name": "Dr Incomplete",
            "gender": "Other", "dob": "1990-01-01", "account_email": "incomplete@example.test",
            "account_mobile_number": "8123456789", "specialization": self.specialization.specialization_id,
            "consultation_fee": "75.00", "qualification": "MD", "experience_years": 4,
            "license_number": "LIC-INCOMPLETE",
        }
        serializer = DoctorSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("department", serializer.errors)
        missing = DoctorSerializer(data={key: value for key, value in payload.items() if key != "password"} | {
            "department": self.department.department_id,
        })
        self.assertFalse(missing.is_valid())
        self.assertIn("password", missing.errors)

    def test_doctor_serializer_rejects_wrong_role_department_and_duplicate_profile(self):
        payload = {
            "staff": self.staff.staff_id, "department": self.department.department_id,
            "specialization": self.specialization.specialization_id, "consultation_fee": "10.00",
            "qualification": "MD", "experience_years": 2, "license_number": "LIC-OTHER",
        }
        duplicate = DoctorSerializer(data=payload)
        self.assertFalse(duplicate.is_valid())
        self.assertIn("staff", duplicate.errors)

        other_department = Department.objects.create(department_name="Surgery", description="Surgical care")
        other_role = Role.objects.create(role_name="Receptionist")
        other_user = User.objects.create_user(username="unrelated-staff", password="secret", role=other_role)
        other_staff = Staff.objects.create(
            user=other_user, full_name="Other Staff", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090002", email="other@example.test", department=other_department,
        )
        wrong_role = DoctorSerializer(data={**payload, "staff": other_staff.staff_id, "license_number": "LIC-WRONG"})
        self.assertFalse(wrong_role.is_valid())
        self.assertIn("staff", wrong_role.errors)

        new_doctor_staff = Staff.objects.create(
            user=User.objects.create_user(username="doctor-other-dept", password="secret", role=self.role),
            full_name="Other Doctor", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090003", email="doctor-other@example.test", department=other_department,
        )
        mismatch = DoctorSerializer(data={**payload, "staff": new_doctor_staff.staff_id, "license_number": "LIC-MISMATCH"})
        self.assertFalse(mismatch.is_valid())
        self.assertIn("department", mismatch.errors)

    def test_doctor_create_rechecks_duplicate_after_validation_inside_create(self):
        new_staff = Staff.objects.create(
            user=User.objects.create_user(username="race-doctor-staff", password="secret", role=self.role),
            full_name="Dr Race", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090004", email="race-doctor@example.test", department=self.department,
        )
        payload = {
            "staff": new_staff.staff_id, "department": self.department.department_id,
            "specialization": self.specialization.specialization_id, "consultation_fee": "10.00",
            "qualification": "MD", "experience_years": 2, "license_number": "RACE-LIC",
        }
        first = DoctorSerializer(data=payload)
        second = DoctorSerializer(data=payload)
        self.assertTrue(first.is_valid(), first.errors)
        self.assertTrue(second.is_valid(), second.errors)

        first.save()
        with self.assertRaises(ValidationError):
            second.save()
        self.assertEqual(Doctor.objects.filter(staff=new_staff).count(), 1)

    def test_doctor_effective_access_status_includes_all_linked_active_flags(self):
        self.assertTrue(DoctorSerializer(self.doctor).data["effective_access_active"])
        self.staff_user.is_active = False
        self.staff_user.save(update_fields=["is_active"])
        self.assertFalse(DoctorSerializer(self.doctor).data["effective_access_active"])

    def test_staff_status_update_does_not_reactivate_a_doctor_user_account(self):
        self.staff_user.is_active = False
        self.staff_user.save(update_fields=["is_active"])
        serializer = StaffSerializer(self.staff, data={"is_active": True}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.staff_user.refresh_from_db()
        self.assertFalse(self.staff_user.is_active)
        self.assertFalse(DoctorSerializer(self.doctor).data["effective_access_active"])

    def test_availability_frontend_and_serializer_contract_fields_have_weekday_range(self):
        for weekday in (-1, 7):
            serializer = DoctorAvailabilitySerializer(data={
                "doctor": self.doctor.doctor_id, "weekday": weekday,
                "start_time": "09:00", "end_time": "17:00", "is_active": True,
            })
            self.assertFalse(serializer.is_valid())
            self.assertIn("weekday", serializer.errors)

    def test_staff_update_allows_omitted_password_and_rejects_invalid_mobile(self):
        serializer = StaffSerializer(self.staff, data={"full_name": "Updated Name"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.save().full_name, "Updated Name")
        invalid = StaffSerializer(self.staff, data={"mobile_number": "5123456789"}, partial=True)
        self.assertFalse(invalid.is_valid())
        self.assertIn("mobile_number", invalid.errors)

    def test_staff_contact_updates_are_reflected_as_read_only_doctor_fields(self):
        serializer = StaffSerializer(self.staff, data={"full_name": "Dr Updated", "email": "updated@example.test"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        doctor_data = DoctorSerializer(self.doctor).data
        self.assertEqual(doctor_data["doctor_name"], "Dr Updated")
        self.assertEqual(doctor_data["email"], "updated@example.test")
        self.assertTrue(DoctorSerializer(self.doctor).fields["email"].read_only)
        self.assertTrue(DoctorSerializer(self.doctor).fields["mobile_number"].read_only)
        read_only_update = DoctorSerializer(self.doctor, data={"email": "ignored@example.test", "mobile_number": "8123456789"}, partial=True)
        self.assertTrue(read_only_update.is_valid(), read_only_update.errors)
        self.assertNotIn("email", read_only_update.validated_data)
        self.assertNotIn("mobile_number", read_only_update.validated_data)

    def test_doctor_profile_department_update_keeps_staff_department_aligned(self):
        new_department = Department.objects.create(department_name="Medicine", description="Medical care")
        serializer = DoctorSerializer(self.doctor, data={"department": new_department.department_id}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.staff.refresh_from_db()
        self.assertEqual(updated.department_id, new_department.department_id)
        self.assertEqual(self.staff.department_id, new_department.department_id)

    def test_doctor_medicine_and_lab_amounts_are_nonnegative_and_integer_fields_are_whole(self):
        unlinked_staff = Staff.objects.create(
            user=User.objects.create_user(username="validation-doctor-candidate", password="safe-test-pass", role=self.role),
            full_name="Dr Candidate", gender="Other", dob=date(1980, 1, 1),
            mobile_number="9000090004", email="candidate@example.test", department=self.department,
        )
        doctor_data = {
            "staff": unlinked_staff.staff_id, "department": self.department.department_id,
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
