from rest_framework import serializers
from .models import Patient, Appointment


class PatientSerializer(serializers.ModelSerializer):

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
            "is_active",
        ]

        read_only_fields = ["patient_id"]


class AppointmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Appointment
        fields = [
            "appointment_id",
            "patient",
            "doctor",
            "receptionist",
            "appointment_date",
            "appointment_time",
            "token_number",
            "reason",
            "status",
            "created_at",
            "is_active",
        ]

        read_only_fields = [
            "appointment_id",
            "created_at",
        ]