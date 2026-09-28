from rest_framework import serializers
from core.models import Appointment,Patient,Consultation,Prescription, PrescriptionMedicine,PrescriptionLabTest,MedicalRecord


from datetime import date


class AppointmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Appointment
        fields = [
            'appointment_id',
            'patient',
            'doctor',
            'receptionist',
            'appointment_date',
            'appointment_time',
            'token_number',
            'reason',
            'status',
            'created_at',
            'is_active'
        ]

class PatientDetailsSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'patient_id',
            'full_name',
            'age',
            'gender',
            'mobile_number',
            'email',
            'address',
            'blood_group',
            'emergency_contact',
        ]

    def get_age(self, obj):
        today = date.today()

        age = today.year - obj.dob.year

        if (today.month, today.day) < (obj.dob.month, obj.dob.day):
            age -= 1

        return age

class ConsultationSerializer(serializers.ModelSerializer):
        

        patientdetails = PatientDetailsSerializer(
        source='appointment.patient',
        read_only=True
        )

        class Meta:
            model = Consultation
            fields = [
                'consultation_id',
                'appointment',
                'doctor',
                'patientdetails',
                'symptoms',
                'diagnosis',
                'notes',
                'consultation_date',
                'is_active'
            ]

            read_only_fields = [
                'consultation_id',
                'appointment',
                'doctor',
                'consultation_date'
            ]

class PrescriptionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Prescription
        fields = [
            'prescription_id',
            'consultation',
            'patient',
            'doctor',
            'prescription_date',
            'is_active'
        ]

        read_only_fields = [
            'prescription_id',
            'consultation',
            'patient',
            'doctor',
            'prescription_date'
        ]


class PrescriptionMedicineSerializer(serializers.ModelSerializer):

    medicine_name = serializers.CharField(
        source='medicine.medicine_name',
        read_only=True
    )

    class Meta:
        model = PrescriptionMedicine
        fields = [
            'item_id',
            'prescription',
            'medicine',
            'medicine_name',
            'dosage',
            'frequency',
            'duration',
            'instructions',
            'is_active'
        ]

        read_only_fields = [
            'item_id',
            'prescription',
            'medicine_name'
        ]

class PrescriptionLabTestSerializer(serializers.ModelSerializer):

    test_name = serializers.CharField(
        source='test.test_name',
        read_only=True
    )

    class Meta:
        model = PrescriptionLabTest
        fields = [
            'prescription_lab_test_id',
            'prescription',
            'test',
            'test_name',
            'instructions',
            'is_active'
        ]

        read_only_fields = [
            'prescription_lab_test_id',
            'prescription',
            'test_name'
        ]


class MedicalRecordSerializer(serializers.ModelSerializer):

    class Meta:
        model = MedicalRecord
        fields = [
            'record_id',
            'patient',
            'doctor',
            'consultation',
            'diagnosis',
            'medical_notes',
            'created_at',
            'is_active'
        ]

        read_only_fields = [
            'record_id',
            'patient',
            'doctor',
            'consultation',
            'created_at'
        ]