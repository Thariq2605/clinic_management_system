from datetime import date
from django.utils import timezone
from rest_framework import serializers

from core.models import (
    Staff,
    Department,
    Doctor,
    Medicine,
    Role,
    User,
    Receptionist,
    Specialization,
    Patient,
    Appointment,
    Consultation,
    Prescription,
    LabTest,
    LabOrder,
    Bill,
    Payment,
    ClinicSetting,
)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["role_id", "role_name", "is_active"]
        read_only_fields = ["role_id"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.role_name", read_only=True)

    class Meta:
        model = User
        fields = ["user_id", "username", "password", "role", "role_name", "is_active"]
        read_only_fields = ["user_id", "role_name"]
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def create(self, validated_data):
        password = validated_data.pop("password", "Admin@123")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class DepartmentSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["department_id", "department_name", "description", "is_active", "doctor_count"]
        read_only_fields = ["department_id", "doctor_count"]

    def get_doctor_count(self, obj):
        return Doctor.objects.filter(department=obj, is_active=True).count()


class SpecializationSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Specialization
        fields = ["specialization_id", "specialization_name", "doctor_count"]
        read_only_fields = ["specialization_id", "doctor_count"]

    def get_doctor_count(self, obj):
        return Doctor.objects.filter(specialization=obj, is_active=True).count()


class StaffSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        write_only=True,
        required=False,
    )
    role_name = serializers.CharField(source="user.role.role_name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)

    class Meta:
        model = Staff
        fields = [
            "staff_id",
            "username",
            "password",
            "role",
            "role_name",
            "full_name",
            "gender",
            "dob",
            "mobile_number",
            "email",
            "department",
            "department_name",
            "is_active",
        ]
        read_only_fields = ["staff_id", "role_name", "department_name"]

    def create(self, validated_data):
        username = validated_data.pop("username", None)
        password = validated_data.pop("password", "Admin@123")
        role = validated_data.pop("role", None)

        if not role:
            # Default to Receptionist role or first role
            role = Role.objects.filter(role_name__iexact="receptionist").first() or Role.objects.first()

        if not username:
            base_user = validated_data.get("email", "").split("@")[0] or validated_data.get("full_name", "staff").lower().replace(" ", "")
            username = base_user
            suffix = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_user}{suffix}"
                suffix += 1

        user = User(username=username, role=role, is_active=True)
        user.set_password(password)
        user.save()

        staff = Staff.objects.create(user=user, **validated_data)

        if role.role_name.lower() == "receptionist":
            Receptionist.objects.get_or_create(staff=staff, defaults={"is_active": True})

        return staff

    def update(self, instance, validated_data):
        validated_data.pop("username", None)
        password = validated_data.pop("password", None)
        role = validated_data.pop("role", None)

        if role and instance.user:
            instance.user.role = role
            instance.user.save()

        if password and instance.user:
            instance.user.set_password(password)
            instance.user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if "is_active" in validated_data and instance.user:
            instance.user.is_active = validated_data["is_active"]
            instance.user.save()

        return instance


class ReceptionistSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="staff.full_name", read_only=True)
    gender = serializers.CharField(source="staff.gender", read_only=True)
    dob = serializers.DateField(source="staff.dob", read_only=True)
    mobile_number = serializers.CharField(source="staff.mobile_number", read_only=True)
    email = serializers.CharField(source="staff.email", read_only=True)
    department_id = serializers.IntegerField(source="staff.department.department_id", read_only=True)
    department_name = serializers.CharField(source="staff.department.department_name", read_only=True)

    class Meta:
        model = Receptionist
        fields = [
            "receptionist_id",
            "staff",
            "full_name",
            "gender",
            "dob",
            "mobile_number",
            "email",
            "department_id",
            "department_name",
            "is_active",
        ]
        read_only_fields = ["receptionist_id", "full_name", "department_name", "mobile_number", "email", "gender", "dob"]


class DoctorSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.department_name", read_only=True)
    specialization_name = serializers.CharField(source="specialization.specialization_name", read_only=True)
    email = serializers.CharField(source="staff.email", read_only=True)
    mobile_number = serializers.CharField(source="staff.mobile_number", read_only=True)

    class Meta:
        model = Doctor
        fields = [
            "doctor_id",
            "staff",
            "doctor_name",
            "specialization",
            "specialization_name",
            "department",
            "department_name",
            "consultation_fee",
            "qualification",
            "experience_years",
            "license_number",
            "email",
            "mobile_number",
            "is_active",
        ]
        read_only_fields = [
            "doctor_id",
            "doctor_name",
            "department_name",
            "specialization_name",
            "email",
            "mobile_number",
        ]

    def get_doctor_name(self, obj):
        return obj.staff.full_name if obj.staff else "Doctor"


class MedicineSerializer(serializers.ModelSerializer):
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = Medicine
        fields = [
            "medicine_id",
            "medicine_name",
            "manufacturer",
            "unit_price",
            "quantity",
            "expiry_date",
            "stock_status",
            "is_active",
        ]
        read_only_fields = ["medicine_id", "stock_status"]

    def get_stock_status(self, obj):
        today = date.today()
        if obj.expiry_date and obj.expiry_date <= today:
            return "Expired"
        if obj.quantity <= 15:
            return "Low Stock"
        return "Available"


class PatientSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "patient_id",
            "full_name",
            "dob",
            "gender",
            "mobile_number",
            "email",
            "address",
            "blood_group",
            "emergency_contact",
            "age",
            "is_active",
        ]
        read_only_fields = ["patient_id", "age"]

    def get_age(self, obj):
        if not obj.dob:
            return None
        today = date.today()
        return today.year - obj.dob.year - ((today.month, today.day) < (obj.dob.month, obj.dob.day))


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mobile = serializers.CharField(source="patient.mobile_number", read_only=True)
    doctor_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="doctor.department.department_name", read_only=True)
    receptionist_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "appointment_id",
            "patient",
            "patient_name",
            "patient_mobile",
            "doctor",
            "doctor_name",
            "department_name",
            "receptionist",
            "receptionist_name",
            "appointment_date",
            "appointment_time",
            "token_number",
            "reason",
            "status",
            "payment_status",
            "created_at",
            "is_active",
        ]
        read_only_fields = [
            "appointment_id",
            "patient_name",
            "patient_mobile",
            "doctor_name",
            "department_name",
            "receptionist_name",
        ]
        extra_kwargs = {
            "receptionist": {"required": False, "allow_null": True},
            "created_at": {"required": False},
            "token_number": {"required": False, "allow_blank": True},
        }

    def get_doctor_name(self, obj):
        return obj.doctor.staff.full_name if obj.doctor and obj.doctor.staff else "Doctor"

    def get_receptionist_name(self, obj):
        return obj.receptionist.staff.full_name if obj.receptionist and obj.receptionist.staff else "Admin"

    def create(self, validated_data):
        if "receptionist" not in validated_data or not validated_data["receptionist"]:
            receptionist = Receptionist.objects.filter(is_active=True).first()
            if not receptionist:
                # If no receptionist exists, assign to first staff
                staff = Staff.objects.first()
                if staff:
                    receptionist, _ = Receptionist.objects.get_or_create(staff=staff, defaults={"is_active": True})
            validated_data["receptionist"] = receptionist

        if not validated_data.get("created_at"):
            validated_data["created_at"] = timezone.now()

        if not validated_data.get("token_number"):
            # Auto generate token number like T-01, T-02
            doc = validated_data.get("doctor")
            adate = validated_data.get("appointment_date")
            count = Appointment.objects.filter(doctor=doc, appointment_date=adate).count() + 1
            validated_data["token_number"] = f"T-{count:02d}"

        return super().create(validated_data)


class LabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTest
        fields = [
            "test_id",
            "test_name",
            "test_type",
            "description",
            "test_fee",
            "normal_range",
            "is_active",
        ]
        read_only_fields = ["test_id"]


class BillSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    paid_amount = serializers.SerializerMethodField()
    balance_amount = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            "bill_id",
            "patient",
            "patient_name",
            "appointment",
            "doctor_name",
            "total_amount",
            "bill_date",
            "payment_status",
            "created_by",
            "created_by_name",
            "paid_amount",
            "balance_amount",
            "is_active",
        ]
        read_only_fields = [
            "bill_id",
            "patient_name",
            "doctor_name",
            "created_by_name",
            "paid_amount",
            "balance_amount",
        ]
        extra_kwargs = {
            "created_by": {"required": False, "allow_null": True},
            "bill_date": {"required": False},
            "payment_status": {"required": False},
        }

    def get_doctor_name(self, obj):
        if obj.appointment and obj.appointment.doctor and obj.appointment.doctor.staff:
            return obj.appointment.doctor.staff.full_name
        return "-"

    def get_paid_amount(self, obj):
        total_paid = sum(p.amount for p in obj.payment_set.filter(is_active=True))
        return total_paid

    def get_balance_amount(self, obj):
        paid = self.get_paid_amount(obj)
        return max(0, float(obj.total_amount) - float(paid))

    def create(self, validated_data):
        if not validated_data.get("bill_date"):
            validated_data["bill_date"] = date.today()
        if not validated_data.get("payment_status"):
            validated_data["payment_status"] = "pending"
        if not validated_data.get("created_by"):
            validated_data["created_by"] = Staff.objects.first()
        return super().create(validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    bill_id = serializers.PrimaryKeyRelatedField(queryset=Bill.objects.all(), source="bill")
    patient_name = serializers.CharField(source="bill.patient.full_name", read_only=True)
    total_bill_amount = serializers.DecimalField(source="bill.total_amount", max_digits=10, decimal_places=2, read_only=True)
    bill_payment_status = serializers.CharField(source="bill.payment_status", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "payment_id",
            "bill_id",
            "patient_name",
            "total_bill_amount",
            "bill_payment_status",
            "amount",
            "payment_method",
            "payment_date",
            "transaction_reference",
            "is_active",
        ]
        read_only_fields = ["payment_id", "patient_name", "total_bill_amount", "bill_payment_status"]
        extra_kwargs = {
            "payment_date": {"required": False},
            "transaction_reference": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        if not validated_data.get("payment_date"):
            validated_data["payment_date"] = timezone.now()
        payment = super().create(validated_data)

        # Update bill payment status based on paid amounts
        bill = payment.bill
        total_paid = sum(p.amount for p in bill.payment_set.filter(is_active=True))
        if total_paid >= bill.total_amount:
            bill.payment_status = "paid"
        elif total_paid > 0:
            bill.payment_status = "partial"
        else:
            bill.payment_status = "pending"
        bill.save()

        # Update linked appointment payment status
        if bill.appointment:
            bill.appointment.payment_status = "Paid" if bill.payment_status == "paid" else "Pending"
            bill.appointment.save()

        return payment


class ClinicSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicSetting
        fields = [
            "setting_id",
            "clinic_name",
            "clinic_email",
            "clinic_phone",
            "clinic_address",
            "timezone",
            "currency",
            "appointment_slot_duration",
            "enable_notifications",
            "enable_email_alerts",
            "updated_at",
        ]
        read_only_fields = ["setting_id", "updated_at"]