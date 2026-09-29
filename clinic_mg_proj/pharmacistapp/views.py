from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from core.models import Medicine, PrescriptionMedicine, User
from .serializers import MedicineSerializer, PrescriptionMedicineSerializer


class PharmacistLoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {"detail": "username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)
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

        if user.role.role_name.lower() != 'pharmacist':
            return Response(
                {"detail": "This account is not registered as a Pharmacist."},
                status=status.HTTP_403_FORBIDDEN
            )

        return Response(
            {
                "detail": f"Welcome, {username}!",
                "user_id": user.user_id,
                "username": user.username,
                "role": user.role.role_name
            },
            status=status.HTTP_200_OK
        )


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer


class PrescriptionMedicineViewSet(viewsets.ModelViewSet):
    queryset = PrescriptionMedicine.objects.all()
    serializer_class = PrescriptionMedicineSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        item = self.get_object()
        medicine = item.medicine

        if not item.is_active:
            return Response(
                {"detail": "This item has already been dispensed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if medicine.quantity < 1:
            return Response(
                {"detail": f"Insufficient stock for {medicine.medicine_name}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        medicine.quantity -= 1
        medicine.save()

        item.is_active = False
        item.save()

        return Response(
            {"detail": f"{medicine.medicine_name} dispensed. Remaining stock: {medicine.quantity}"},
            status=status.HTTP_200_OK
        )