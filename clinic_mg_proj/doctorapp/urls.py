from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    doctor_login,
    doctor_dashboard,
    doctor_appointments,
    appointment_patient_details,
    search_patients,
    create_consultation,
    create_prescription,
    create_lab_test_request,
    patient_medical_history,
    create_medical_record,
    available_medicines,
    available_lab_tests,
    doctor_consultations,
    doctor_medical_history,
    doctor_medical_records,
    doctor_prescriptions,
    doctor_lab_tests


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

    path(
        'patients/<int:doctor_id>/search/',
        search_patients,
        name='search-patients'
    ),
    path(
        'medicines/',
        available_medicines,
        name='available-medicines'
    ),
    path(
        'lab-tests/',
        available_lab_tests,
        name='available-lab-tests'
    ),

    path(
        'consultations/<int:doctor_id>/',
        doctor_consultations,
        name='doctor-consultations'
    ),
    path('history/<int:doctor_id>/', doctor_medical_history, name='doctor-medical-history'),
    path('medical-records/<int:doctor_id>/', doctor_medical_records, name='doctor-medical-records'),
    path('prescriptions/<int:doctor_id>/', doctor_prescriptions, name='doctor-prescriptions'),
    path('lab-test-requests/<int:doctor_id>/', doctor_lab_tests, name='doctor-lab-tests'),
]
