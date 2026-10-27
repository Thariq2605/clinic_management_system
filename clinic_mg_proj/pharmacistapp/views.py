from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from core.models import (
    Bill,
    Medicine,
    Payment,
    Prescription,
    PrescriptionMedicine,
    Staff,
    User,
)
from .serializers import (
    BillSerializer,
    MedicineSerializer,
    PaymentSerializer,
    PrescriptionMedicineSerializer,
    PrescriptionSerializer,
)
from .permissions import IsPharmacist

class PharmacistLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {"detail": "username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active or not user.role or not user.role.is_active or user.role.role_name.strip().lower() != 'pharmacist':
            return Response(
                {"detail": "This account is not registered as a Pharmacist."},
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        refresh['role'] = 'pharmacist'
        staff = getattr(user, "staff", None)
        if staff and not staff.is_active:
            staff = None
        return Response(
            {
                "detail": f"Welcome, {username}!",
                "user_id": user.user_id,
                "username": user.username,
                "role": user.role.role_name,
                "name": staff.full_name if staff else user.username,
                "access": str(refresh.access_token),
            },
            status=status.HTTP_200_OK
        )


class PharmacistMeView(APIView):
    permission_classes = [IsPharmacist]

    def get(self, request):
        staff = getattr(request.user, "staff", None)
        if staff and not staff.is_active:
            staff = None
        return Response({
            "user_id": request.user.user_id,
            "username": request.user.username,
            "role": request.user.role.role_name,
            "name": staff.full_name if staff else request.user.username,
        })


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    permission_classes = [IsPharmacist]


class PrescriptionMedicineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PrescriptionMedicine.objects.all()
    serializer_class = PrescriptionMedicineSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        with transaction.atomic():
            item = self.get_queryset().select_for_update().filter(pk=pk).first()
            if item is None:
                from rest_framework.exceptions import NotFound
                raise NotFound()
            medicine = Medicine.objects.select_for_update().get(pk=item.medicine_id)
            if not item.is_active:
                return Response({"detail": "This item has already been dispensed."}, status=status.HTTP_400_BAD_REQUEST)
            if medicine.quantity < 1:
                return Response({"detail": f"Insufficient stock for {medicine.medicine_name}."}, status=status.HTTP_400_BAD_REQUEST)
            medicine.quantity -= 1
            medicine.save(update_fields=["quantity"])
            item.is_active = False
            item.save(update_fields=["is_active"])

        return Response(
            {"detail": f"{medicine.medicine_name} dispensed. Remaining stock: {medicine.quantity}"},
            status=status.HTTP_200_OK
        )

class PrescriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer
    permission_classes = [IsPharmacist]

    @action(detail=True, methods=['post'])
    def bill(self, request, pk=None):
        prescription = self.get_object()
        dispensed_items = PrescriptionMedicine.objects.filter(prescription=prescription, is_active=False)

        if not dispensed_items.exists():
            return Response(
                {"detail": "No dispensed medicines found for this prescription yet."},
                status=status.HTTP_400_BAD_REQUEST
            )

        total = sum(item.medicine.unit_price for item in dispensed_items)
        appointment = prescription.consultation.appointment

        existing = Bill.objects.filter(appointment=appointment, patient=prescription.patient, payment_status='pending').first()
        if existing:
            existing.total_amount = total
            existing.save()
            bill = existing
        else:
            staff = Staff.objects.filter(user__username='pharma').first()  # adjust username if needed
            bill = Bill.objects.create(
                patient=prescription.patient,
                appointment=appointment,
                total_amount=total,
                bill_date=timezone.now().date(),
                payment_status='pending',
                created_by=staff,
                is_active=True
            )

        return Response(BillSerializer(bill).data, status=status.HTTP_200_OK)

class BillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Bill.objects.all().order_by('-bill_date')
    serializer_class = BillSerializer
    permission_classes = [IsPharmacist]

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        bill = self.get_object()
        if bill.payment_status == 'paid':
            return Response({"detail": "This bill is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        Payment.objects.create(
            bill=bill,
            amount=bill.total_amount,
            payment_method=request.data.get('payment_method', 'cash'),
            payment_date=timezone.now(),
            is_active=True
        )
        bill.payment_status = 'paid'
        bill.save()
        return Response(BillSerializer(bill).data, status=status.HTTP_200_OK)

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        qs = super().get_queryset()
        bill_id = self.request.query_params.get('bill')
        if bill_id is not None:
            qs = qs.filter(bill_id=bill_id)
        return qs
