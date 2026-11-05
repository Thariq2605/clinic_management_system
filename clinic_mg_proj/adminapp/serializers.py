from datetime import date
import re
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email as django_validate_email
from django.db import transaction
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
    DoctorAvailability,
)


def validate_account_password(password, user):
    try:
        django_validate_password(password, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({"password": error.messages})


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["role_id", "role_name", "is_active"]
        read_only_fields = ["role_id"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.role_name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["user_id", "username", "password", "role", "role_name", "is_active"]
        read_only_fields = ["user_id", "role_name"]

    def validate_username(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Username is required.")
        if len(value) > 50:
            raise serializers.ValidationError("Username cannot exceed 50 characters.")
        duplicates = User.objects.filter(username__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate(self, attrs):
        password = attrs.get("password")
        if password is not None and password and not password.strip():
            raise serializers.ValidationError({"password": "Password cannot contain only whitespace."})
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": "Password is required when creating an account."})
        if password:
            candidate = self.instance or User(
                username=attrs.get("username", ""), role=attrs.get("role"),
            )
            if self.instance and "username" in attrs:
                candidate.username = attrs["username"]
            validate_account_password(password, candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password is not None and password != "":
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
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
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

    def validate_username(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Username is required when creating a staff account.")
        if len(value) > 50:
            raise serializers.ValidationError("Username cannot exceed 50 characters.")
        if self.instance is None and User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_password(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Password cannot contain only whitespace.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Full name is required.")
        return value

    def validate_mobile_number(self, value):
        value = value.strip()
        if not re.fullmatch(r"[6-9][0-9]{9}", value):
            raise serializers.ValidationError("Enter a 10-digit mobile number beginning with 6, 7, 8, or 9.")
        return value

    def validate_email(self, value):
        value = value.strip()
        try:
            django_validate_email(value)
        except DjangoValidationError:
            raise serializers.ValidationError("Enter a valid email address.")
        return value

    def validate_dob(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get("username"):
                raise serializers.ValidationError({"username": "Username is required when creating a staff account."})
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "Password is required when creating a staff account."})
        else:
            doctor_profile = Doctor.objects.filter(staff=self.instance).first()
            next_department = attrs.get("department", self.instance.department)
            if doctor_profile and doctor_profile.department_id != next_department.department_id:
                raise serializers.ValidationError({
                    "department": "Change this department through Doctor Management so the Doctor and Staff profiles stay aligned."
                })
            next_role = attrs.get("role")
            if doctor_profile and next_role and next_role.role_name.strip().casefold() != "doctor":
                raise serializers.ValidationError({"role": "A Doctor-linked Staff account must keep the Doctor role."})
        password = attrs.get("password")
        if password:
            user = self.instance.user if self.instance else User(
                username=attrs.get("username", ""), role=attrs.get("role"),
            )
            validate_account_password(password, user)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.pop("username", None)
        password = validated_data.pop("password")
        role = validated_data.pop("role", None)

        if not role:
            # Preserve the existing Staff API default for callers that omit role.
            role = Role.objects.filter(role_name__iexact="receptionist").first() or Role.objects.first()
        if role is None:
            raise serializers.ValidationError({"role": "Create a role before creating a Staff account."})

        if not username:
            base_user = validated_data.get("email", "").split("@")[0] or validated_data.get("full_name", "staff").lower().replace(" ", "")
            username = base_user
            suffix = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_user}{suffix}"
                suffix += 1

        active = validated_data.get("is_active", True)
        user = User(username=username, role=role, is_active=active)
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

        if password is not None and password != "" and instance.user:
            instance.user.set_password(password)
            instance.user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Keep the long-standing Staff/User status behavior for non-Doctor
        # accounts. Doctor access flags remain independent and are evaluated
        # together by Doctor login and the Admin effective-status display.
        if "is_active" in validated_data and instance.user and not Doctor.objects.filter(staff=instance).exists():
            instance.user.is_active = validated_data["is_active"]
            instance.user.save(update_fields=["is_active"])

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
    # Account and Staff fields are accepted only when creating a linked Doctor.
    username = serializers.CharField(write_only=True, required=False, max_length=50)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    full_name = serializers.CharField(write_only=True, required=False, max_length=100)
    gender = serializers.ChoiceField(choices=["Male", "Female", "Other"], write_only=True, required=False)
    dob = serializers.DateField(write_only=True, required=False)
    account_email = serializers.EmailField(write_only=True, required=False, max_length=100)
    account_mobile_number = serializers.CharField(write_only=True, required=False, max_length=15)
    doctor_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.department_name", read_only=True)
    specialization_name = serializers.CharField(source="specialization.specialization_name", read_only=True)
    staff_id = serializers.IntegerField(source="staff.staff_id", read_only=True)
    staff_name = serializers.CharField(source="staff.full_name", read_only=True)
    user_id = serializers.IntegerField(source="staff.user.user_id", read_only=True)
    email = serializers.CharField(source="staff.email", read_only=True)
    mobile_number = serializers.CharField(source="staff.mobile_number", read_only=True)
    username_display = serializers.CharField(source="staff.user.username", read_only=True)
    staff_active = serializers.BooleanField(source="staff.is_active", read_only=True)
    user_active = serializers.BooleanField(source="staff.user.is_active", read_only=True)
    role_active = serializers.BooleanField(source="staff.user.role.is_active", read_only=True)
    effective_access_active = serializers.SerializerMethodField()
    staff = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.select_related("user__role", "department"), required=False)

    class Meta:
        model = Doctor
        fields = [
            "doctor_id",
            "staff",
            "doctor_name",
            "staff_id",
            "user_id",
            "staff_name",
            "username_display",
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
            "staff_active",
            "user_active",
            "role_active",
            "effective_access_active",
            "username",
            "password",
            "full_name",
            "gender",
            "dob",
            "account_email",
            "account_mobile_number",
            "is_active",
        ]
        read_only_fields = [
            "doctor_id",
            "doctor_name",
            "department_name",
            "specialization_name",
            "staff_id",
            "user_id",
            "staff_name",
            "username_display",
            "email",
            "mobile_number",
            "staff_active",
            "user_active",
            "role_active",
            "effective_access_active",
        ]

    def get_doctor_name(self, obj):
        return obj.staff.full_name if obj.staff else "Doctor"

    def get_effective_access_active(self, obj):
        user = obj.staff.user if obj.staff_id and obj.staff.user_id else None
        return bool(obj.is_active and obj.staff.is_active and user and user.is_active and user.role_id and user.role.is_active)

    def validate_username(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_password(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Password cannot contain only whitespace.")
        return value

    def validate_account_mobile_number(self, value):
        value = value.strip()
        if not re.fullmatch(r"[6-9][0-9]{9}", value):
            raise serializers.ValidationError("Enter a 10-digit mobile number beginning with 6, 7, 8, or 9.")
        return value

    def validate(self, attrs):
        account_fields = {
            "username", "password", "full_name", "gender", "dob",
            "account_email", "account_mobile_number",
        }
        if self.instance is not None and account_fields.intersection(attrs):
            raise serializers.ValidationError({
                "staff": "Edit linked identity and contact details through the Staff profile workflow."
            })
        staff = attrs.get("staff", getattr(self.instance, "staff", None))
        department = attrs.get("department", getattr(self.instance, "department", None))
        if self.instance is None and staff is None:
            required = ("username", "password", "full_name", "gender", "dob", "account_email", "account_mobile_number")
            missing = [field for field in required if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError({field: "This field is required to create a Doctor account." for field in missing})
            if attrs.get("password"):
                validate_account_password(attrs["password"], User(username=attrs.get("username", "")))
        elif staff is not None:
            user = staff.user
            role_name = user.role.role_name.strip().casefold() if user.role_id else ""
            if role_name != "doctor":
                raise serializers.ValidationError({"staff": "Doctor profiles can only be linked to Staff with the Doctor role."})
            if not staff.is_active or not user.is_active or not user.role.is_active:
                raise serializers.ValidationError({"staff": "The linked User, role, and Staff account must all be active."})
            if department and staff.department_id != department.department_id and (self.instance is None or "staff" in attrs):
                raise serializers.ValidationError({"department": "Doctor and Staff departments must match."})
            duplicates = Doctor.objects.filter(staff=staff)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError({"staff": "This Staff member already has a Doctor profile."})
        if department is None:
            raise serializers.ValidationError({"department": "Department is required."})
        if not department.is_active:
            raise serializers.ValidationError({"department": "Select an active department."})
        if self.instance is None and staff is None and not Role.objects.filter(role_name__iexact="Doctor", is_active=True).exists():
            raise serializers.ValidationError({"role": "An active Doctor role must exist before creating a Doctor account."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        staff = validated_data.pop("staff", None)
        if staff is None:
            username = validated_data.pop("username")
            password = validated_data.pop("password")
            full_name = validated_data.pop("full_name")
            gender = validated_data.pop("gender")
            dob = validated_data.pop("dob")
            email = validated_data.pop("account_email")
            mobile_number = validated_data.pop("account_mobile_number")
            active = validated_data.get("is_active", True)
            role = Role.objects.filter(role_name__iexact="Doctor", is_active=True).first()
            if role is None:
                raise serializers.ValidationError({"role": "An active Doctor role must exist before creating a Doctor account."})
            user = User(username=username, role=role, is_active=active)
            user.set_password(password)
            user.save()
            staff = Staff.objects.create(
                user=user, full_name=full_name.strip(), gender=gender, dob=dob,
                mobile_number=mobile_number.strip(), email=email.strip(),
                department=validated_data["department"], is_active=active,
            )
        else:
            # Validation happens before create() opens its transaction. Lock the
            # existing Staff row and recheck here so concurrent requests for
            # the same Staff member serialize on MySQL/InnoDB.
            staff = Staff.objects.select_for_update().get(pk=staff.pk)
            if Doctor.objects.filter(staff=staff).exists():
                raise serializers.ValidationError({
                    "staff": "This Staff member already has a Doctor profile."
                })
        return Doctor.objects.create(staff=staff, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        department = validated_data.get("department")
        if department is not None and instance.staff.department_id != department.department_id:
            instance.staff.department = department
            instance.staff.save(update_fields=["department"])
        return super().update(instance, validated_data)

    def validate_consultation_fee(self, value):
        if value < 0:
            raise serializers.ValidationError("Consultation fee cannot be negative.")
        return value

    def validate_experience_years(self, value):
        if value < 0:
            raise serializers.ValidationError("Years of experience cannot be negative.")
        return value

    def validate_qualification(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Qualification is required.")
        return value

    def validate_license_number(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("License number is required.")
        return value


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

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value


VALID_GENDERS = ["Male", "Female", "Other"]
VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


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

    def validate_full_name(self, value):
        if value is None:
            raise serializers.ValidationError("Please enter a valid patient name.")
        trimmed = str(value).strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError("Please enter a valid patient name.")
        if len(trimmed) > 100:
            raise serializers.ValidationError("Full name cannot exceed 100 characters.")
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
            return ""
        trimmed = str(value).strip().upper()
        if trimmed not in VALID_BLOOD_GROUPS:
            raise serializers.ValidationError("Please select a valid blood group.")
        return trimmed

    def validate_mobile_number(self, value):
        if value is None:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        val = str(value).strip()
        if not re.fullmatch(r"[6-9][0-9]{9}", val):
            raise serializers.ValidationError("Enter a 10-digit mobile number beginning with 6, 7, 8, or 9.")
        return val

    def validate_emergency_contact(self, value):
        if value is None:
            return ""
        val = str(value).strip()
        if not val:
            return ""
        if not re.fullmatch(r"[6-9][0-9]{9}", val):
            raise serializers.ValidationError("Enter a 10-digit mobile number beginning with 6, 7, 8, or 9.")
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
            return ""
        val = str(value).strip()
        if not val:
            return ""
        if len(val) > 255:
            raise serializers.ValidationError("Residential address cannot exceed 255 characters.")
        return val

    def validate(self, attrs):
        mobile = attrs.get("mobile_number")
        if mobile:
            qs = Patient.objects.filter(mobile_number__iexact=mobile.strip(), is_active=True)
            if self.instance:
                qs = qs.exclude(patient_id=self.instance.patient_id)
            if qs.exists():
                raise serializers.ValidationError({"mobile_number": "A patient with this mobile number already exists."})
        return attrs


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


class DoctorAvailabilitySerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.staff.full_name", read_only=True)
    weekday_name = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = DoctorAvailability
        fields = ["availability_id", "doctor", "doctor_name", "weekday", "weekday_name",
                  "start_time", "end_time", "is_active"]
        read_only_fields = ["availability_id", "doctor_name", "weekday_name"]

    def validate(self, attrs):
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if doctor and active:
            user = doctor.staff.user
            if not doctor.is_active or not doctor.staff.is_active or not user.is_active or not user.role.is_active:
                raise serializers.ValidationError({"doctor": "Choose a Doctor whose profile, Staff, User, and role are active."})
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        if doctor and weekday is not None and active:
            conflicts = DoctorAvailability.objects.filter(
                doctor=doctor, weekday=weekday, is_active=True,
                start_time__lte=end, end_time__gte=start,
            )
            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError({"start_time": "This interval overlaps another active interval for that weekday."})
        return attrs


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

    def validate_test_fee(self, value):
        if value < 0:
            raise serializers.ValidationError("Test fee cannot be negative.")
        return value


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
    clinic_email = serializers.EmailField(required=False, max_length=100)

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

    def validate_clinic_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Clinic name is required.")
        return value

    def validate_clinic_email(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Clinic email is required.")
        return value

    def validate_clinic_phone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Clinic phone is required.")
        return value

    def validate_clinic_address(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Clinic address is required.")
        return value

    def validate_timezone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Timezone is required.")
        return value

    def validate_currency(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Currency is required.")
        return value

    def validate_appointment_slot_duration(self, value):
        if value < 1:
            raise serializers.ValidationError("Appointment slot duration must be at least 1 minute.")
        return value
