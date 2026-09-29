from django.utils import timezone
from rest_framework import serializers

from core.models import Appointment, Department, Doctor, Patient, Payment


class PatientSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()

    class Meta:
        model = Patient
        fields = ("patient_id", "full_name", "dob", "gender", "mobile_number",
                  "email", "address", "blood_group", "emergency_contact")
        read_only_fields = ("patient_id",)

    def validate_dob(self, value):
        if value >= timezone.localdate():
            raise serializers.ValidationError("Date of birth must be in the past.")
        return value


class PatientSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ("patient_id", "full_name", "dob", "gender", "mobile_number", "email")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("department_id", "department_name")


class DoctorSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="staff.full_name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)

    class Meta:
        model = Doctor
        fields = ("doctor_id", "doctor_name", "department", "department_name", "consultation_fee")


class AppointmentCreateSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField(min_value=1)
    department_id = serializers.IntegerField(min_value=1)
    doctor_id = serializers.IntegerField(min_value=1)
    appointment_date = serializers.DateField()
    appointment_time = serializers.TimeField()
    reason = serializers.CharField(max_length=255)

    def validate(self, attrs):
        now = timezone.localtime()
        if attrs["appointment_date"] < now.date():
            raise serializers.ValidationError({"appointment_date": "Date cannot be in the past."})
        if attrs["appointment_date"] == now.date() and attrs["appointment_time"] <= now.time().replace(tzinfo=None):
            raise serializers.ValidationError({"appointment_time": "Time must be in the future."})
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
                  "token_number", "consultation_fee", "reason", "status",
                  "payment_status", "is_active")
        read_only_fields = fields

    def get_consultation_fee(self, appointment):
        bill = appointment.bill_set.filter(is_active=True).order_by("-bill_id").first()
        return str(bill.total_amount if bill else appointment.doctor.consultation_fee)


class PaymentInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("amount", "payment_method", "transaction_reference")
        extra_kwargs = {"transaction_reference": {"required": False, "allow_blank": True}}

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value
