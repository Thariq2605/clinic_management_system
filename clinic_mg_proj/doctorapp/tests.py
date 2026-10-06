from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Appointment,
    Bill,
    Department,
    Doctor,
    Patient,
    Payment,
    Receptionist,
    Role,
    Specialization,
    Staff,
    User,
    Consultation,
)


class PaymentGatedAppointmentAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        # Department & Specialization
        self.department = Department.objects.create(
            department_name="General Medicine",
            description="General care department"
        )
        self.specialization = Specialization.objects.create(
            specialization_name="General Physician"
        )

        # Receptionist Role, User, Staff & Record
        self.receptionist_role = Role.objects.create(role_name="Receptionist")
        self.receptionist_user = User.objects.create_user(
            username="receptionist_test",
            password="password123",
            role=self.receptionist_role,
            is_active=True
        )
        self.receptionist_staff = Staff.objects.create(
            user=self.receptionist_user,
            full_name="Receptionist Jane",
            gender="Female",
            dob=date(1992, 5, 10),
            mobile_number="9876543201",
            email="jane@medicare.com",
            department=self.department
        )
        self.receptionist = Receptionist.objects.create(staff=self.receptionist_staff)

        # Doctor 1 Role, User, Staff & Doctor record
        self.doctor_role = Role.objects.create(role_name="Doctor")
        self.doctor1_user = User.objects.create_user(
            username="doctor_thariq",
            password="password123",
            role=self.doctor_role,
            is_active=True
        )
        self.doctor1_staff = Staff.objects.create(
            user=self.doctor1_user,
            full_name="Dr. Thariq",
            gender="Male",
            dob=date(1985, 3, 15),
            mobile_number="9876543202",
            email="thariq@medicare.com",
            department=self.department
        )
        self.doctor1 = Doctor.objects.create(
            staff=self.doctor1_staff,
            specialization=self.specialization,
            department=self.department,
            consultation_fee=Decimal("500.00"),
            qualification="MBBS, MD",
            experience_years=12,
            license_number="MED-12345"
        )

        # Doctor 2 (for cross-doctor access tests)
        self.doctor2_user = User.objects.create_user(
            username="doctor_sarah",
            password="password123",
            role=self.doctor_role,
            is_active=True
        )
        self.doctor2_staff = Staff.objects.create(
            user=self.doctor2_user,
            full_name="Dr. Sarah",
            gender="Female",
            dob=date(1988, 8, 20),
            mobile_number="9876543203",
            email="sarah@medicare.com",
            department=self.department
        )
        self.doctor2 = Doctor.objects.create(
            staff=self.doctor2_staff,
            specialization=self.specialization,
            department=self.department,
            consultation_fee=Decimal("600.00"),
            qualification="MBBS, MS",
            experience_years=8,
            license_number="MED-54321"
        )

        # Patient
        self.patient = Patient.objects.create(
            full_name="John Doe",
            dob=date(1990, 1, 1),
            gender="Male",
            mobile_number="9876543210",
            email="john.doe@example.com",
            address="123 Health St",
            blood_group="O+",
            emergency_contact="9876543211"
        )

        # JWT Tokens for Doctor 1
        refresh1 = RefreshToken.for_user(self.doctor1_user)
        refresh1["doctor_id"] = self.doctor1.doctor_id
        refresh1["role"] = "doctor"
        self.doctor1_token = str(refresh1.access_token)

        # JWT Tokens for Doctor 2
        refresh2 = RefreshToken.for_user(self.doctor2_user)
        refresh2["doctor_id"] = self.doctor2.doctor_id
        refresh2["role"] = "doctor"
        self.doctor2_token = str(refresh2.access_token)

    def auth_doctor1(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.doctor1_token}")

    def auth_doctor2(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.doctor2_token}")

    def auth_receptionist(self):
        self.client.credentials()  # clear JWT
        self.client.post(
            "/api/receptionist/login/",
            {"username": "receptionist_test", "password": "password123"}
        )

    def create_test_appointment(self, doctor=None, fee=Decimal("500.00"), appt_type="walk_in", appt_date=None):
        doc = doctor or self.doctor1
        date_val = appt_date or self.today
        appt = Appointment.objects.create(
            patient=self.patient,
            doctor=doc,
            receptionist=self.receptionist,
            appointment_date=date_val,
            appointment_time="10:30:00",
            token_number="1",
            reason="Checkup",
            status="scheduled",
            payment_status="Pending",
            appointment_type=appt_type,
            created_at=timezone.now(),
        )
        bill = Bill.objects.create(
            patient=self.patient,
            appointment=appt,
            total_amount=fee,
            bill_date=date_val,
            payment_status="pending",
            created_by=self.receptionist_staff,
        )
        return appt, bill

    # -----------------------------------------------------------
    # 1. Unpaid appointment blocks Doctor access
    # -----------------------------------------------------------
    def test_unpaid_appointment_blocks_doctor_access(self):
        appt, bill = self.create_test_appointment()
        self.auth_doctor1()

        # Try to view patient details for unpaid appointment
        res_patient = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res_patient.status_code, 403)
        self.assertIn("Payment is not completed", res_patient.data.get("error", ""))

        # Try to start/create consultation for unpaid appointment
        res_consult = self.client.post(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/consultation/",
            {"symptoms": "Headache", "diagnosis": "Migraine", "notes": "Rest"}
        )
        self.assertEqual(res_consult.status_code, 403)
        self.assertIn("Payment is not completed", res_consult.data.get("error", ""))

    # -----------------------------------------------------------
    # 2. Paid appointment allows Doctor consultation access
    # -----------------------------------------------------------
    def test_paid_appointment_allows_doctor_access(self):
        appt, bill = self.create_test_appointment()

        # Receptionist pays in full
        self.auth_receptionist()
        pay_res = self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "500.00", "payment_method": "cash"}
        )
        self.assertEqual(pay_res.status_code, 201)

        # Refresh from DB
        appt.refresh_from_db()
        bill.refresh_from_db()
        self.assertEqual(bill.payment_status, "paid")
        self.assertEqual(appt.payment_status, "Paid")

        # Doctor 1 accesses appointment
        self.auth_doctor1()
        res_patient = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res_patient.status_code, 200)
        self.assertEqual(res_patient.data["payment_status"], "Paid")

        res_consult = self.client.post(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/consultation/",
            {"symptoms": "Headache", "diagnosis": "Migraine", "notes": "Prescribed medicine"}
        )
        self.assertEqual(res_consult.status_code, 201)

    # -----------------------------------------------------------
    # 3. Partial payment keeps Doctor blocked
    # -----------------------------------------------------------
    def test_partial_payment_keeps_doctor_blocked(self):
        appt, bill = self.create_test_appointment(fee=Decimal("1000.00"))

        # Pay ₹400 of ₹1000
        self.auth_receptionist()
        pay_res = self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "400.00", "payment_method": "cash"}
        )
        self.assertEqual(pay_res.status_code, 201)

        appt.refresh_from_db()
        bill.refresh_from_db()
        self.assertEqual(bill.payment_status, "partial")
        self.assertEqual(appt.payment_status, "Pending")

        # Doctor must remain blocked
        self.auth_doctor1()
        res_patient = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res_patient.status_code, 403)

        res_consult = self.client.post(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/consultation/",
            {"symptoms": "Fever", "diagnosis": "Viral", "notes": "Bed rest"}
        )
        self.assertEqual(res_consult.status_code, 403)

        # Now pay remaining ₹600
        self.auth_receptionist()
        pay_res2 = self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "600.00", "payment_method": "upi", "transaction_reference": "UPI123456789"}
        )
        self.assertEqual(pay_res2.status_code, 201)

        appt.refresh_from_db()
        bill.refresh_from_db()
        self.assertEqual(bill.payment_status, "paid")
        self.assertEqual(appt.payment_status, "Paid")

        # Doctor access is now unlocked
        self.auth_doctor1()
        res_patient_unlocked = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res_patient_unlocked.status_code, 200)

    # -----------------------------------------------------------
    # 4. Payment validation failure keeps Doctor blocked
    # -----------------------------------------------------------
    def test_failed_payments_keep_doctor_blocked(self):
        appt, bill = self.create_test_appointment(fee=Decimal("500.00"))
        self.auth_receptionist()

        # Zero amount rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "0", "payment_method": "cash"})
        self.assertEqual(res.status_code, 400)

        # Negative amount rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "-50.00", "payment_method": "cash"})
        self.assertEqual(res.status_code, 400)

        # Overpayment rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "600.00", "payment_method": "cash"})
        self.assertEqual(res.status_code, 400)

        # Missing payment mode rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "500.00"})
        self.assertEqual(res.status_code, 400)

        # Card without reference rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "500.00", "payment_method": "card"})
        self.assertEqual(res.status_code, 400)

        # UPI without reference rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "500.00", "payment_method": "upi"})
        self.assertEqual(res.status_code, 400)

        # Online without reference rejected
        res = self.client.post(f"/api/receptionist/bills/{bill.bill_id}/payments/",
                               {"amount": "500.00", "payment_method": "online"})
        self.assertEqual(res.status_code, 400)

        # Appointment status remains Pending and Doctor access blocked
        appt.refresh_from_db()
        self.assertEqual(appt.payment_status, "Pending")
        self.auth_doctor1()
        res_blocked = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res_blocked.status_code, 403)

    # -----------------------------------------------------------
    # 5. Duplicate payment on already fully paid bill is rejected
    # -----------------------------------------------------------
    def test_duplicate_payment_prevented(self):
        appt, bill = self.create_test_appointment(fee=Decimal("500.00"))
        self.auth_receptionist()

        # First full payment
        res1 = self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "500.00", "payment_method": "cash"}
        )
        self.assertEqual(res1.status_code, 201)

        # Duplicate payment attempt
        res2 = self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "500.00", "payment_method": "cash"}
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already fully paid", res2.data.get("error", ""))

        # Verify only 1 payment was created
        self.assertEqual(Payment.objects.filter(bill=bill).count(), 1)

    # -----------------------------------------------------------
    # 6. Unauthorized doctor cannot access other doctor's appointment
    # -----------------------------------------------------------
    def test_other_doctor_cannot_access_appointment(self):
        appt, bill = self.create_test_appointment(doctor=self.doctor1)

        # Pay in full
        self.auth_receptionist()
        self.client.post(
            f"/api/receptionist/bills/{bill.bill_id}/payments/",
            {"amount": "500.00", "payment_method": "cash"}
        )

        # Doctor 2 tries to access Doctor 1's appointment
        self.auth_doctor2()
        res = self.client.get(
            f"/doctor/appointments/{self.doctor2.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res.status_code, 404)

        res_consult = self.client.post(
            f"/doctor/appointments/{self.doctor2.doctor_id}/{appt.appointment_id}/consultation/",
            {"symptoms": "Cough", "diagnosis": "Bronchitis", "notes": "Syrup"}
        )
        self.assertEqual(res_consult.status_code, 404)

    # -----------------------------------------------------------
    # 7. Walk-In unpaid appointment is protected
    # -----------------------------------------------------------
    def test_walk_in_unpaid_remains_protected(self):
        appt, bill = self.create_test_appointment(appt_type="walk_in")
        self.auth_doctor1()

        res = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res.status_code, 403)

    # -----------------------------------------------------------
    # 8. Pre-booked unpaid appointment is protected
    # -----------------------------------------------------------
    def test_pre_booked_unpaid_remains_protected(self):
        tomorrow = self.today + timedelta(days=1)
        appt, bill = self.create_test_appointment(appt_type="pre_booking", appt_date=tomorrow)
        self.auth_doctor1()

        res = self.client.get(
            f"/doctor/appointments/{self.doctor1.doctor_id}/{appt.appointment_id}/patient/"
        )
        self.assertEqual(res.status_code, 403)

    # -----------------------------------------------------------
    # 9. Prescription creation blocked if appointment unpaid
    # -----------------------------------------------------------
    def test_prescription_and_lab_test_blocked_if_unpaid(self):
        appt, bill = self.create_test_appointment()

        # Create consultation directly in DB simulating bypass attempt
        consult = Consultation.objects.create(
            appointment=appt,
            doctor=self.doctor1,
            symptoms="Cough",
            diagnosis="Common cold",
            notes="Rest",
            consultation_date=self.today,
            is_active=True
        )

        self.auth_doctor1()

        # Doctor tries to create prescription
        res_rx = self.client.post(
            f"/doctor/consultations/{self.doctor1.doctor_id}/{consult.consultation_id}/prescription/",
            {"medicines": [{"medicine_id": 1, "dosage": "500mg", "duration": "5 days"}]}
        )
        self.assertEqual(res_rx.status_code, 403)

        # Doctor tries to create lab test
        res_lab = self.client.post(
            f"/doctor/consultations/{self.doctor1.doctor_id}/{consult.consultation_id}/lab-test/",
            {"test_id": 1, "priority": "normal"}
        )
        self.assertEqual(res_lab.status_code, 403)

        # Doctor tries to create medical record
        res_mr = self.client.post(
            f"/doctor/consultations/{self.doctor1.doctor_id}/{consult.consultation_id}/medical-record/",
            {}
        )
        self.assertEqual(res_mr.status_code, 403)

    # -----------------------------------------------------------
    # 10. Doctor appointment list returns payment_status
    # -----------------------------------------------------------
    def test_doctor_appointments_list_includes_payment_status(self):
        appt1, bill1 = self.create_test_appointment()
        self.auth_doctor1()

        res = self.client.get(f"/doctor/appointments/{self.doctor1.doctor_id}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data) > 0)
        item = [x for x in res.data if x["appointment_id"] == appt1.appointment_id][0]
        self.assertEqual(item["payment_status"], "Pending")

        # Now pay
        self.auth_receptionist()
        self.client.post(
            f"/api/receptionist/bills/{bill1.bill_id}/payments/",
            {"amount": "500.00", "payment_method": "cash"}
        )

        # Recheck
        self.auth_doctor1()
        res2 = self.client.get(f"/doctor/appointments/{self.doctor1.doctor_id}/")
        self.assertEqual(res2.status_code, 200)
        item2 = [x for x in res2.data if x["appointment_id"] == appt1.appointment_id][0]
        self.assertEqual(item2["payment_status"], "Paid")
