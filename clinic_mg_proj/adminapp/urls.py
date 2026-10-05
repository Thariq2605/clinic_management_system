from django.urls import path

from .views import (
    AdminCurrentUserView,
    RoleListCreateView,
    RoleDetailView,
    UserListCreateView,
    UserDetailView,
    DepartmentListCreateView,
    DepartmentDetailView,
    SpecializationListCreateView,
    SpecializationDetailView,
    StaffListCreateView,
    StaffDetailView,
    ReceptionistListCreateView,
    ReceptionistDetailView,
    DoctorListCreateView,
    DoctorDetailView,
    MedicineListCreateView,
    MedicineDetailView,
    PatientListCreateView,
    PatientDetailView,
    PatientProfileView,
    AppointmentListCreateView,
    AppointmentDetailView,
    BillListCreateView,
    BillDetailView,
    PaymentListCreateView,
    PaymentDetailView,
    LabTestListCreateView,
    LabTestDetailView,
    AdminDashboardView,
    AdminReportsView,
    AdminSettingsView,
)

urlpatterns = [
    # Current User Profile
    path("me/", AdminCurrentUserView.as_view(), name="admin-me"),

    # Roles & Users
    path("roles/", RoleListCreateView.as_view(), name="role-list-create"),
    path("roles/<int:pk>/", RoleDetailView.as_view(), name="role-detail"),
    path("users/", UserListCreateView.as_view(), name="user-list-create"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),

    # Departments
    path("departments/", DepartmentListCreateView.as_view(), name="department-list-create"),
    path("departments/<int:pk>/", DepartmentDetailView.as_view(), name="department-detail"),

    # Specializations
    path("specializations/", SpecializationListCreateView.as_view(), name="specialization-list-create"),
    path("specializations/<int:pk>/", SpecializationDetailView.as_view(), name="specialization-detail"),

    # Staff & Receptionists
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("staff/<int:pk>/", StaffDetailView.as_view(), name="staff-detail"),
    path("receptionists/", ReceptionistListCreateView.as_view(), name="receptionist-list-create"),
    path("receptionists/<int:pk>/", ReceptionistDetailView.as_view(), name="receptionist-detail"),

    # Doctors
    path("doctors/", DoctorListCreateView.as_view(), name="doctor-list-create"),
    path("doctors/<int:pk>/", DoctorDetailView.as_view(), name="doctor-detail"),

    # Medicines
    path("medicines/", MedicineListCreateView.as_view(), name="medicine-list-create"),
    path("medicines/<int:pk>/", MedicineDetailView.as_view(), name="medicine-detail"),

    # Patients
    path("patients/", PatientListCreateView.as_view(), name="patient-list-create"),
    path("patients/<int:pk>/", PatientDetailView.as_view(), name="patient-detail"),
    path("patients/<int:pk>/profile/", PatientProfileView.as_view(), name="patient-profile"),

    # Appointments
    path("appointments/", AppointmentListCreateView.as_view(), name="appointment-list-create"),
    path("appointments/<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),

    # Billing & Payments
    path("bills/", BillListCreateView.as_view(), name="bill-list-create"),
    path("bills/<int:pk>/", BillDetailView.as_view(), name="bill-detail"),
    path("payments/", PaymentListCreateView.as_view(), name="payment-list-create"),
    path("payments/<int:pk>/", PaymentDetailView.as_view(), name="payment-detail"),

    # Lab Tests
    path("lab-tests/", LabTestListCreateView.as_view(), name="lab-test-list-create"),
    path("lab-tests/<int:pk>/", LabTestDetailView.as_view(), name="lab-test-detail"),

    # Dashboard & Reports & Settings
    path("dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("reports/", AdminReportsView.as_view(), name="admin-reports"),
    path("settings/", AdminSettingsView.as_view(), name="admin-settings"),
]