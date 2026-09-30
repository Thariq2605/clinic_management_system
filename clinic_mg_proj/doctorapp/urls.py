from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    doctor_login,
    doctor_dashboard,
    doctor_appointments,
    appointment_patient_details,
    create_consultation,
    create_prescription,
    create_lab_test_request,
    patient_medical_history,
    create_medical_record

)


urlpatterns = [

    path(
        'login/',
        doctor_login,
        name='doctor-login'
    ),

    path(
        'token/refresh/',
        TokenRefreshView.as_view(),
        name='doctor-token-refresh'
    ),

    path(
        'dashboard/<int:doctor_id>/',
        doctor_dashboard,
        name='doctor-dashboard'
    ),

    path(
       'appointments/<int:doctor_id>/',
        doctor_appointments,
        name='doctor-appointments'
    ),

    path(
        'appointments/<int:doctor_id>/<int:appointment_id>/patient/',
        appointment_patient_details,
        name='appointment-patient-details'
    ),

    path(
        'appointments/<int:doctor_id>/<int:appointment_id>/consultation/',
        create_consultation,
        name='create-consultation'
    ),

    path(
        'consultations/<int:doctor_id>/<int:consultation_id>/prescription/',
        create_prescription,
        name='create-prescription'
    ),

    path(
        'consultations/<int:doctor_id>/<int:consultation_id>/lab-test/',
        create_lab_test_request,
        name='create-lab-test-request'
    ),

    path(
        'patients/<int:doctor_id>/<int:patient_id>/history/',
        patient_medical_history,
        name='patient-medical-history'
    ),

    path(
        'consultations/<int:doctor_id>/<int:consultation_id>/medical-record/',
        create_medical_record,
        name='create-medical-record'
),
]
