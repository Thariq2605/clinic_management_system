from rest_framework import serializers
from doctorapp.models import Medicine, PrescriptionMedicine


class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = [
            'medicine_id', 'medicine_name', 'manufacturer',
            'unit_price', 'quantity', 'expiry_date', 'is_active'
        ]


class PrescriptionMedicineSerializer(serializers.ModelSerializer):
    medicine_details = serializers.StringRelatedField(source='medicine', read_only=True)

    class Meta:
        model = PrescriptionMedicine
        fields = [
            'item_id', 'prescription', 'medicine', 'medicine_details',
            'dosage', 'frequency', 'duration', 'instructions', 'is_active'
        ]