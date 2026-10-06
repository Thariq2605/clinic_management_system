import re
from datetime import date, timedelta
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email as django_validate_email
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from core.models import Appointment, Bill, Department, Doctor, Patient, Payment

VALID_GENDERS = ["Male", "Female", "Other"]
VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


class PatientValidationMixin:
    """
    Common field validation logic for Patient models across serializers.
    """

    def validate_full_name(self, value):
        if value is None:
            raise serializers.ValidationError("Please enter a valid patient name.")
        trimmed = str(value).strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError("Please enter a valid patient name.")
        if len(trimmed) > 100:
            raise serializers.ValidationError("Full name cannot exceed 100 characters.")
        # Allow alphabetic characters with spaces and normal name punctuation (. - ')
        if not re.match(r"^[a-zA-Z\s\.\'\-]+$", trimmed) or not any(c.isalpha() for c in trimmed):
            raise serializers.ValidationError("Please enter a valid patient name.")
        return trimmed

    def validate_dob(self, value):
        if value is None:
            raise serializers.ValidationError("Date of birth is required.")
        if value > timezone.localdate():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        if value < date(1900, 1, 1):
            raise serializers.ValidationError("Please enter a valid date of birth.")
        return value

    def validate_gender(self, value):
        if value is None or not str(value).strip():
            raise serializers.ValidationError("Please select a valid gender.")
        trimmed = str(value).strip()
        matched = next((g for g in VALID_GENDERS if g.lower() == trimmed.lower()), None)
        if not matched:
            raise serializers.ValidationError("Please select a valid gender.")
        return matched

    def validate_blood_group(self, value):
        if value is None or not str(value).strip():
            raise serializers.ValidationError("Please select a valid blood group.")
        trimmed = str(value).strip().upper()
        if trimmed not in VALID_BLOOD_GROUPS:
            raise serializers.ValidationError("Please select a valid blood group.")
        return trimmed

    def validate_mobile_number(self, value):
        if value is None:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        val = str(value).strip()
        if not re.match(r"^[0-9]{10}$", val):
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        return val

    def validate_emergency_contact(self, value):
        if value is None:
            return ""
        val = str(value).strip()
        if not val:
            return ""
        if not re.match(r"^[0-9]{10}$", val):
            raise serializers.ValidationError("Emergency contact must contain exactly 10 digits.")
        return val

    def validate_email(self, value):
        if value is None:
            return ""
        val = str(value).strip().lower()
        if not val:
            return ""
        try:
            django_validate_email(val)
        except DjangoValidationError:
            raise serializers.ValidationError("Please enter a valid email address.")
        return val

    def validate_address(self, value):
        if value is None:
            raise serializers.ValidationError("Please enter a valid residential address.")
        val = str(value).strip()
        if not val:
            raise serializers.ValidationError("Please enter a valid residential address.")
        if len(val) > 255:
            raise serializers.ValidationError("Residential address cannot exceed 255 characters.")
        return val


class PatientSerializer(PatientValidationMixin, serializers.ModelSerializer):
    email = serializers.EmailField(error_messages={"invalid": "Please enter a valid email address."})
    address = serializers.CharField(max_length=255)
    emergency_contact = serializers.CharField(max_length=15)

    class Meta:
        model = Patient
        fields = ("patient_id", "full_name", "dob", "gender", "mobile_number",
                  "email", "address", "blood_group", "emergency_contact")
        read_only_fields = ("patient_id",)

    def validate_emergency_contact(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Emergency contact must contain exactly 10 digits.")
        val = str(value).strip()
        if not re.match(r"^[0-9]{10}$", val):
            raise serializers.ValidationError("Emergency contact must contain exactly 10 digits.")
        return val

    def validate_email(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Please enter a valid email address.")
        val = str(value).strip().lower()
        try:
            django_validate_email(val)
        except DjangoValidationError:
            raise serializers.ValidationError("Please enter a valid email address.")
        return val


class PatientUpdateSerializer(PatientValidationMixin, serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True, error_messages={"invalid": "Please enter a valid email address."})
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    emergency_contact = serializers.CharField(required=False, allow_blank=True, max_length=15)

    class Meta:
        model = Patient
        fields = ("patient_id", "full_name", "dob", "gender", "mobile_number",
                  "email", "address", "blood_group", "emergency_contact")
        read_only_fields = ("patient_id",)
        extra_kwargs = {
            "full_name": {"required": False},
            "dob": {"required": False},
            "gender": {"required": False},
            "mobile_number": {"required": False},
            "address": {"required": False},
            "blood_group": {"required": False},
            "emergency_contact": {"required": False},
        }

    def validate_address(self, value):
        if value is None:
            return ""
        val = str(value).strip()
        if not val:
            raise serializers.ValidationError("Please enter a valid residential address.")
        if len(val) > 255:
            raise serializers.ValidationError("Residential address cannot exceed 255 characters.")
        return val


class PatientSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ("patient_id", "full_name", "dob", "gender", "mobile_number", "email")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("department_id", "department_name")


from .services import get_doctor_working_hours, get_doctor_display_name


class DoctorSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="staff.full_name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)
    working_hours_start = serializers.SerializerMethodField()
    working_hours_end = serializers.SerializerMethodField()
    working_hours_display = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = (
            "doctor_id", "doctor_name", "department", "department_name",
            "consultation_fee", "working_hours_start", "working_hours_end",
            "working_hours_display"
        )

    def get_working_hours_start(self, doctor):
        start, _ = get_doctor_working_hours(doctor)
        return start.strftime("%H:%M")

    def get_working_hours_end(self, doctor):
        _, end = get_doctor_working_hours(doctor)
        return end.strftime("%H:%M")

    def get_working_hours_display(self, doctor):
        start, end = get_doctor_working_hours(doctor)
        return f"{start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}"


class AppointmentCreateSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField(min_value=1)
    department_id = serializers.IntegerField(min_value=1)
    doctor_id = serializers.IntegerField(min_value=1)
    appointment_date = serializers.DateField()
    appointment_time = serializers.TimeField()
    appointment_type = serializers.CharField(required=False, allow_blank=True, default="pre_booking")
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="Regular consultation")

    def validate_appointment_type(self, value):
        val = str(value or "").strip().lower().replace("-", "_")
        if val in ["walk_in", "walkin"]:
            return "walk_in"
        elif val in ["pre_booking", "prebooking", ""]:
            return "pre_booking"
        else:
            raise serializers.ValidationError(f"Invalid appointment type: {value}.")

    def validate(self, attrs):
        if not attrs.get("reason"):
            attrs["reason"] = "Regular consultation"
        now = timezone.localtime()
        today = now.date()
        tomorrow = today + timedelta(days=1)
        max_prebooking_date = today + timedelta(days=10)
        current_time = now.time().replace(second=0, microsecond=0)

        app_date = attrs["appointment_date"]
        app_time = attrs["appointment_time"]
        appointment_type = attrs.get("appointment_type", "pre_booking")

        if appointment_type == "walk_in":
            if app_date != today:
                raise serializers.ValidationError({"appointment_date": "Walk-In appointments can only be booked for today."})
            if app_time.replace(second=0, microsecond=0) < current_time:
                raise serializers.ValidationError({"appointment_time": "Walk-In appointment time cannot be in the past."})
        elif appointment_type == "pre_booking":
            if app_date < tomorrow:
                raise serializers.ValidationError({"appointment_date": "Pre-Booking is only available from tomorrow onwards. Please use Walk-In for today's appointments."})
            if app_date > max_prebooking_date:
                raise serializers.ValidationError({"appointment_date": "Pre-Booking appointments can only be made up to 10 days in advance."})

        patient = Patient.objects.filter(patient_id=attrs.pop("patient_id"), is_active=True).first()
        if patient is None:
            raise serializers.ValidationError({"patient_id": "Active patient was not found."})

        department = Department.objects.filter(
            department_id=attrs.pop("department_id"), is_active=True
        ).first()
        if department is None:
            raise serializers.ValidationError({"department_id": "Active department was not found."})

        doctor = Doctor.objects.select_related("staff", "department").filter(
            doctor_id=attrs.pop("doctor_id"), is_active=True,
            staff__is_active=True, department__is_active=True,
        ).first()
        if doctor is None:
            raise serializers.ValidationError({"doctor_id": "Active doctor was not found."})

        if doctor.department_id != department.department_id:
            raise serializers.ValidationError(
                {"doctor_id": "Doctor does not belong to the selected department."}
            )

        if Doctor.objects.filter(staff=doctor.staff, is_active=True).count() > 1:
            raise serializers.ValidationError(
                {"doctor_id": "Selected doctor has duplicate active records in the database."}
            )

        # Doctor Working-Hours Validation (start and end times are inclusive)
        start_time, end_time = get_doctor_working_hours(doctor)
        app_time_cmp = app_time.replace(second=0, microsecond=0)
        start_time_cmp = start_time.replace(second=0, microsecond=0)
        end_time_cmp = end_time.replace(second=0, microsecond=0)

        if app_time_cmp < start_time_cmp or app_time_cmp > end_time_cmp:
            doc_name = get_doctor_display_name(doctor)
            start_str = start_time_cmp.strftime("%I:%M %p")
            end_str = end_time_cmp.strftime("%I:%M %p")
            raise serializers.ValidationError({
                "appointment_time": f"Appointment time must be within {doc_name}'s working hours ({start_str} - {end_str})."
            })

        attrs.update(patient=patient, department=department, doctor=doctor)
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.staff.full_name", read_only=True)
    department_id = serializers.IntegerField(source="doctor.department_id", read_only=True)
    department_name = serializers.CharField(source="doctor.department.department_name", read_only=True)
    consultation_fee = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ("appointment_id", "patient", "patient_name", "doctor", "doctor_name",
                  "department_id", "department_name", "appointment_date", "appointment_time",
                  "appointment_type", "token_number", "consultation_fee", "reason", "status",
                  "payment_status", "is_active")
        read_only_fields = fields

    def get_consultation_fee(self, appointment):
        bill = appointment.bill_set.filter(is_active=True).order_by("-bill_id").first()
        return str(bill.total_amount if bill else appointment.doctor.consultation_fee)


class AppointmentDetailSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_dob = serializers.DateField(source="patient.dob", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    patient_mobile = serializers.CharField(source="patient.mobile_number", read_only=True)
    patient_email = serializers.CharField(source="patient.email", read_only=True)
    patient_blood_group = serializers.CharField(source="patient.blood_group", read_only=True)
    doctor_name = serializers.CharField(source="doctor.staff.full_name", read_only=True)
    doctor_qualification = serializers.CharField(source="doctor.qualification", read_only=True)
    department_id = serializers.IntegerField(source="doctor.department_id", read_only=True)
    department_name = serializers.CharField(source="doctor.department.department_name", read_only=True)
    receptionist_name = serializers.CharField(source="receptionist.staff.full_name", read_only=True)
    consultation_fee = serializers.SerializerMethodField()
    billing_details = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "appointment_id", "patient", "patient_name", "patient_dob", "patient_gender",
            "patient_mobile", "patient_email", "patient_blood_group", "doctor",
            "doctor_name", "doctor_qualification", "department_id", "department_name",
            "receptionist_name", "appointment_date", "appointment_time", "appointment_type",
            "token_number", "consultation_fee", "reason", "status", "payment_status",
            "billing_details", "created_at", "is_active"
        )
        read_only_fields = fields

    def get_consultation_fee(self, appointment):
        bill = appointment.bill_set.filter(is_active=True).order_by("-bill_id").first()
        return str(bill.total_amount if bill else appointment.doctor.consultation_fee)

    def get_billing_details(self, appointment):
        bill = appointment.bill_set.filter(is_active=True).order_by("-bill_id").first()
        if not bill:
            return None
        paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"] or 0
        return {
            "bill_id": bill.bill_id,
            "total_amount": str(bill.total_amount),
            "paid_amount": str(paid),
            "outstanding_balance": str(bill.total_amount - paid),
            "bill_date": str(bill.bill_date),
            "bill_payment_status": bill.payment_status,
        }


class PaymentInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("amount", "payment_method", "transaction_reference")
        extra_kwargs = {
            "transaction_reference": {"required": False, "allow_blank": True, "allow_null": True},
            "payment_method": {"error_messages": {"required": "Please select a payment mode."}}
        }

    def validate_payment_method(self, value):
        if not value:
            raise serializers.ValidationError("Please select a payment mode.")
        val_lower = str(value).strip().lower()
        valid_methods = dict(Payment.PAYMENT_METHOD_CHOICES).keys()
        if val_lower not in valid_methods:
            raise serializers.ValidationError("Please select a valid payment mode (Cash, Card, UPI, Online).")
        return val_lower

    def validate_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than 0.")
        return value

    def validate(self, attrs):
        method = attrs.get("payment_method")
        ref = attrs.get("transaction_reference")
        if not method:
            raise serializers.ValidationError({"payment_method": "Please select a payment mode."})
        method_lower = str(method).strip().lower()
        if method_lower in ("card", "upi", "online"):
            if not ref or not str(ref).strip():
                method_display = "UPI" if method_lower == "upi" else method_lower.capitalize()
                raise serializers.ValidationError({
                    "transaction_reference": f"Transaction ID is required for {method_display} payments."
                })
        return attrs


class PaymentHistorySerializer(serializers.ModelSerializer):
    payment_mode_display = serializers.CharField(source="get_payment_method_display", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "payment_id", "bill", "amount", "payment_method", "payment_mode_display",
            "payment_date", "transaction_reference", "is_active"
        )
        read_only_fields = fields


class BillSerializer(serializers.ModelSerializer):
    bill_number = serializers.SerializerMethodField()
    patient_id = serializers.IntegerField(source="patient.patient_id", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mobile = serializers.CharField(source="patient.mobile_number", read_only=True)
    appointment_id = serializers.IntegerField(source="appointment.appointment_id", read_only=True)
    doctor_id = serializers.IntegerField(source="appointment.doctor.doctor_id", read_only=True)
    doctor_name = serializers.CharField(source="appointment.doctor.staff.full_name", read_only=True)
    department_name = serializers.CharField(source="appointment.doctor.department.department_name", read_only=True)
    bill_type = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    token_number = serializers.CharField(source="appointment.token_number", read_only=True)
    appointment_status = serializers.CharField(source="appointment.status", read_only=True)
    payments = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = (
            "bill_id", "bill_number", "patient_id", "patient_name", "patient_mobile",
            "appointment_id", "doctor_id", "doctor_name", "department_name",
            "bill_type", "bill_date", "total_amount", "paid_amount",
            "outstanding_balance", "payment_status", "token_number",
            "appointment_status", "payments", "is_active"
        )
        read_only_fields = fields

    def get_bill_number(self, bill):
        return f"BILL-{bill.bill_id:04d}"

    def get_bill_type(self, bill):
        return "Consultation Fee"

    def get_paid_amount(self, bill):
        paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"] or 0
        return str(paid)

    def get_outstanding_balance(self, bill):
        paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"] or 0
        balance = max(0, bill.total_amount - paid)
        return str(balance)

    def get_payments(self, bill):
        payments = bill.payment_set.filter(is_active=True).order_by("-payment_date")
        return PaymentHistorySerializer(payments, many=True).data


class TokenQueueAppointmentSerializer(serializers.ModelSerializer):
    patient_id = serializers.IntegerField(source="patient.patient_id", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    doctor_id = serializers.IntegerField(source="doctor.doctor_id", read_only=True)
    doctor_name = serializers.CharField(source="doctor.staff.full_name", read_only=True)
    department_name = serializers.CharField(source="doctor.department.department_name", read_only=True)
    queue_status = serializers.SerializerMethodField()
    token_display = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "appointment_id", "token_number", "token_display", "patient_id",
            "patient_name", "patient_gender", "doctor_id", "doctor_name",
            "department_name", "appointment_date", "appointment_time",
            "appointment_type", "reason", "status", "queue_status",
            "payment_status", "created_at"
        )
        read_only_fields = fields

    def get_queue_status(self, appointment):
        if appointment.status == "serving":
            return "Serving"
        elif appointment.status == "completed":
            return "Completed"
        elif appointment.status in ("scheduled", "confirmed"):
            return "Waiting"
        return appointment.status.capitalize()

    def get_token_display(self, appointment):
        try:
            return f"{int(appointment.token_number):03d}"
        except (ValueError, TypeError):
            return str(appointment.token_number)
