from django.urls import path

from . import views

app_name = "receptionist"

urlpatterns = [
    path("csrf/", views.csrf_token, name="csrf-token"),
    path("login/", views.receptionist_login, name="login"),
    path("logout/", views.receptionist_logout, name="logout"),
    path("patients/", views.patients, name="patients"),
    path("departments/", views.departments, name="departments"),
    path("doctors/", views.doctors, name="doctors"),
    path("doctors/<int:doctor_id>/availability/", views.doctor_availability, name="doctor-availability"),
    path("appointments/", views.appointments, name="appointments"),
    path("appointments/<int:appointment_id>/", views.cancel_appointment, name="cancel-appointment"),
    path("appointments/<int:appointment_id>/payments/", views.record_payment, name="record-payment"),
]
