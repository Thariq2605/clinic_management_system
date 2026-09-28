from rest_framework import viewsets, filters
from .models import Patient, Appointment
from .serializers import PatientSerializer, AppointmentSerializer


class PatientViewSet(viewsets.ModelViewSet):

    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    filter_backends = [filters.SearchFilter]
    search_fields = [
        "full_name",
        "mobile_number",
        "email",
    ]


class AppointmentViewSet(viewsets.ModelViewSet):

    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer

    filter_backends = [filters.SearchFilter]
    search_fields = [
        "patient__full_name",
        "doctor__staff__full_name",
        "token_number",
    ]