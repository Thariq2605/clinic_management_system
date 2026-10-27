from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from core.models import Medicine, PrescriptionMedicine, User, Prescription
from .serializers import MedicineSerializer, PrescriptionMedicineSerializer ,PrescriptionSerializer
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
