from rest_framework import serializers
from core.models import Medicine, PrescriptionMedicine
from core.models import Prescription
from core.models import Bill, Payment

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = [
            'medicine_id', 'medicine_name', 'manufacturer',
            'unit_price', 'quantity', 'expiry_date', 'is_active'
        ]

    def validate_medicine_name(self, value):
        qs = Medicine.objects.filter(medicine_name__iexact=value)
        # when editing an existing medicine, exclude itself from the duplicate check
        if self.instance:
            qs = qs.exclude(medicine_id=self.instance.medicine_id)
        if qs.exists():
            raise serializers.ValidationError(f'"{value}" already exists. Edit the existing medicine instead of adding a duplicate.')
        return value
    
class PrescriptionMedicineSerializer(serializers.ModelSerializer):
    medicine_details = serializers.StringRelatedField(source='medicine', read_only=True)

    class Meta:
        model = PrescriptionMedicine
        fields = [
            'item_id', 'prescription', 'medicine', 'medicine_details',
            'dosage', 'frequency', 'duration', 'instructions', 'is_active'
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.staff.full_name', read_only=True)

    class Meta:
        model = Prescription
        fields = ['prescription_id', 'patient_name', 'doctor_name', 'prescription_date']




class BillSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)

    class Meta:
        model = Bill
        fields = ['bill_id', 'patient', 'patient_name', 'appointment', 'total_amount', 'bill_date', 'payment_status', 'created_by']
        read_only_fields = ['bill_id', 'bill_date']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['payment_id', 'bill', 'amount', 'payment_method', 'payment_date', 'transaction_reference']
        read_only_fields = ['payment_id', 'payment_date']