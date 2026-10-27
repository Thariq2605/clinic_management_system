from decimal import Decimal

from rest_framework import serializers

from core.models import Medicine, PrescriptionMedicine
from core.models import Prescription
from core.models import Bill, Payment
from .models import PharmacyDispense

class MedicineSerializer(serializers.ModelSerializer):
    unit_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.00")
    )
    quantity = serializers.IntegerField(min_value=0)

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
        fields = [
            'prescription_id', 'patient', 'patient_name', 'doctor',
            'doctor_name', 'prescription_date'
        ]


class DispenseInputSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class PharmacyDispenseSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = PharmacyDispense
        fields = [
            "dispense_id", "prescription_medicine", "medicine_name",
            "quantity", "unit_price", "line_total",
        ]



class BillSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    items = PharmacyDispenseSerializer(
        source="pharmacy_dispenses", many=True, read_only=True
    )

    class Meta:
        model = Bill
        fields = [
            'bill_id', 'patient', 'patient_name', 'appointment', 'total_amount',
            'bill_date', 'payment_status', 'created_by', 'items',
        ]
        read_only_fields = ['bill_id', 'bill_date']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['payment_id', 'bill', 'amount', 'payment_method', 'payment_date', 'transaction_reference']
        read_only_fields = ['payment_id', 'payment_date']


class PaymentInputSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=Payment.PAYMENT_METHOD_CHOICES)
    amount_verified = serializers.BooleanField()
    transaction_reference = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=100
    )

    def validate(self, attrs):
        if not attrs["amount_verified"]:
            raise serializers.ValidationError({
                "amount_verified": "Verify the bill against the quantity actually dispensed before recording payment."
            })
        if attrs["payment_method"] != "cash" and not attrs.get("transaction_reference", "").strip():
            raise serializers.ValidationError({
                "transaction_reference": "Enter the reference from the verified card or electronic payment."
            })
        return attrs
