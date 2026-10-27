from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.db.models import Sum
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from rest_framework.exceptions import NotFound
from core.models import (
    Appointment,
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
    PaymentInputSerializer,
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

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class PrescriptionMedicineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PrescriptionMedicine.objects.all()
    serializer_class = PrescriptionMedicineSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        qs = super().get_queryset().filter(prescription__is_active=True)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        with transaction.atomic():
            item = self.get_queryset().select_for_update().filter(pk=pk).first()
            if item is None:
                raise NotFound()
            medicine = Medicine.objects.select_for_update().get(pk=item.medicine_id)
            if not item.is_active:
                return Response({"detail": "This item has already been dispensed."}, status=status.HTTP_400_BAD_REQUEST)
            if not medicine.is_active:
                return Response({"detail": "This medicine is inactive and cannot be dispensed."}, status=status.HTTP_400_BAD_REQUEST)
            if medicine.expiry_date < timezone.localdate():
                return Response({"detail": "Expired medicine cannot be dispensed."}, status=status.HTTP_400_BAD_REQUEST)
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

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True).select_related(
            "patient", "consultation__appointment"
        )

    @action(detail=True, methods=['post'])
    def bill(self, request, pk=None):
        with transaction.atomic():
            prescription = self.get_object()
            appointment = prescription.consultation.appointment
            appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)
            if appointment.patient_id != prescription.patient_id:
                return Response(
                    {"detail": "Prescription patient does not match the appointment patient."},
                    status=status.HTTP_409_CONFLICT
                )

            staff = Staff.objects.filter(user=request.user, is_active=True).first()
            if staff is None:
                return Response(
                    {"detail": "An active pharmacist staff record is required to create a medicine bill."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            prescription_items = list(
                PrescriptionMedicine.objects.select_for_update().filter(
                    prescription=prescription
                ).select_related("medicine")
            )
            if not prescription_items:
                return Response(
                    {"detail": "This prescription has no medicine items."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if any(item.is_active for item in prescription_items):
                return Response(
                    {"detail": "The prescription is not fully dispensed. Resolve every medicine item before billing."},
                    status=status.HTTP_409_CONFLICT
                )

            pharmacy_bill_exists = Bill.objects.filter(
                appointment=appointment,
                is_active=True,
                created_by__user__role__role_name__iexact="pharmacist",
            ).exists()
            if pharmacy_bill_exists:
                return Response(
                    {"detail": "A pharmacy bill already exists for this appointment. Duplicate billing is blocked."},
                    status=status.HTTP_409_CONFLICT
                )

            total = sum(
                (item.medicine.unit_price for item in prescription_items),
                Decimal("0.00"),
            )
            bill = Bill.objects.create(
                patient=prescription.patient,
                appointment=appointment,
                total_amount=total,
                bill_date=timezone.localdate(),
                payment_status="pending",
                created_by=staff,
                is_active=True,
            )

        return Response(BillSerializer(bill).data, status=status.HTTP_200_OK)

class BillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Bill.objects.all().order_by('-bill_date')
    serializer_class = BillSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        return super().get_queryset().filter(
            is_active=True,
            created_by__user__role__role_name__iexact="pharmacist",
        ).select_related("patient", "appointment", "created_by")

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        serializer = PaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            bill = self.get_queryset().select_for_update().filter(pk=pk).first()
            if bill is None:
                raise NotFound()
            paid = bill.payment_set.filter(is_active=True).aggregate(
                total=Sum("amount")
            )["total"] or Decimal("0.00")
            remaining = bill.total_amount - paid
            if remaining <= 0:
                return Response(
                    {"detail": "This bill has no outstanding balance."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            Payment.objects.create(
                bill=bill,
                amount=remaining,
                payment_method=serializer.validated_data["payment_method"],
                transaction_reference=serializer.validated_data.get("transaction_reference"),
                payment_date=timezone.now(),
                is_active=True
            )
            bill.payment_status = 'paid'
            bill.save(update_fields=["payment_status"])
        return Response(BillSerializer(bill).data, status=status.HTTP_200_OK)

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        qs = super().get_queryset().filter(
            is_active=True,
            bill__is_active=True,
            bill__created_by__user__role__role_name__iexact="pharmacist",
        )
        bill_id = self.request.query_params.get('bill')
        if bill_id is not None:
            qs = qs.filter(bill_id=bill_id)
        return qs
