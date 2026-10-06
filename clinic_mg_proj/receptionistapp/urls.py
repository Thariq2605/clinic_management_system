from django.urls import path

from . import views

app_name = "receptionist"

urlpatterns = [
    path("csrf/", views.csrf_token, name="csrf-token"),
    path("login/", views.receptionist_login, name="login"),
    path("logout/", views.receptionist_logout, name="logout"),
    path("patients/", views.patients, name="patients"),
    path("patients/<int:patient_id>/", views.patient_detail, name="patient-detail"),
    path("patients/<int:patient_id>/status/", views.patient_status, name="patient-status"),
    path("departments/", views.departments, name="departments"),
    path("doctors/", views.doctors, name="doctors"),
    path("doctors/<int:doctor_id>/availability/", views.doctor_availability, name="doctor-availability"),
    path("appointments/", views.appointments, name="appointments"),
    path("appointments/<int:appointment_id>/", views.appointment_detail, name="appointment-detail"),
    path("appointments/<int:appointment_id>/payments/", views.appointment_payments, name="appointment-payments"),
    path("bills/", views.billing_list, name="bills-list"),
    path("bills/<int:bill_id>/", views.bill_detail, name="bill-detail"),
    path("bills/<int:bill_id>/payments/", views.bill_payments, name="bill-payments"),
    path("token-queue/", views.token_queue_today, name="token-queue"),
    path("token-queue/today/", views.token_queue_today, name="token-queue-today"),
    path("token-queue/call-next/", views.token_queue_call_next, name="token-queue-call-next"),
    path("token-queue/<int:appointment_id>/complete/", views.token_queue_complete, name="token-queue-complete"),
]
