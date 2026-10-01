from rest_framework import serializers

from core.models import Staff, Department, Doctor, Medicine, Role, User, Receptionist


class StaffSerializer(serializers.ModelSerializer):

    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        write_only=True
    )

    class Meta:
        model = Staff

        fields = [
            "staff_id",
            "username",
            "password",
            "role",
            "full_name",
            "gender",
            "dob",
            "mobile_number",
            "email",
            "department",
            "is_active",
        ]

        read_only_fields = ["staff_id"]

    def create(self, validated_data):

        username = validated_data.pop("username")
        password = validated_data.pop("password")
        role = validated_data.pop("role")

        # Create User
        user = User(
            username=username,
            role=role,
            is_active=True
        )
        user.set_password(password)
        user.save()

        # Create Staff
        staff = Staff.objects.create(
            user=user,
            **validated_data
        )

        # Create Receptionist profile automatically
        if role.role_name.lower() == "receptionist":
            Receptionist.objects.create(
                staff=staff,
                is_active=True
            )

        return staff


class DepartmentSerializer(serializers.ModelSerializer):

    class Meta:

        model = Department

        fields = [
            "department_id",
            "department_name",
            "description",
            "is_active",
        ]

        read_only_fields = ["department_id"]


class DoctorSerializer(serializers.ModelSerializer):

    doctor_name = serializers.SerializerMethodField()

    class Meta:

        model = Doctor

        fields = [
            "doctor_id",
            "staff",
            "doctor_name",
            "specialization",
            "department",
            "consultation_fee",
            "qualification",
            "experience_years",
            "license_number",
            "is_active",
        ]

        read_only_fields = [
            "doctor_id",
            "doctor_name",
        ]

    def get_doctor_name(self, obj):
        return obj.staff.full_name
        
class MedicineSerializer(serializers.ModelSerializer):

    class Meta:

        model = Medicine

        fields = [
            "medicine_id",
            "medicine_name",
            "manufacturer",
            "unit_price",
            "quantity",
            "expiry_date",
            "is_active",
        ]

        read_only_fields = ["medicine_id"]
        
class RoleSerializer(serializers.ModelSerializer):

    class Meta:
        model = Role

        fields = [
            "role_id",
            "role_name",
            "is_active",
        ]

        read_only_fields = ["role_id"]
        
        
class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User

        fields = [
            "user_id",
            "username",
            "password",
            "role",
            "is_active",
        ]

        read_only_fields = ["user_id"]

        extra_kwargs = {
            "password": {
                "write_only": True
            }
        }

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

        if password:
            instance.set_password(password)

        instance.save()

        return instance