from django.urls import path

from .views import (
    StaffListCreateView,
    StaffDetailView,
    DepartmentListCreateView,
    DepartmentDetailView,
    DoctorListCreateView,
    DoctorDetailView,
    MedicineListCreateView,
    MedicineDetailView,
    RoleDetailView,
    RoleListCreateView,
    UserDetailView,
    UserListCreateView,
)


urlpatterns = [

    path(
        "staff/",
        StaffListCreateView.as_view(),
        name="staff-list-create",
    ),

    path(
        "staff/<int:pk>/",
        StaffDetailView.as_view(),
        name="staff-detail",
    ),

    path(
        "departments/",
        DepartmentListCreateView.as_view(),
        name="department-list-create",
    ),

    path(
        "departments/<int:pk>/",
        DepartmentDetailView.as_view(),
        name="department-detail",
    ),

    path(
        "doctors/",
        DoctorListCreateView.as_view(),
        name="doctor-list-create",
    ),

    path(
        "doctors/<int:pk>/",
        DoctorDetailView.as_view(),
        name="doctor-detail",
    ),
    
    path(
    "medicines/",
    MedicineListCreateView.as_view(),
    name="medicine-list-create",
    ),

    path(
    "medicines/<int:pk>/",
    MedicineDetailView.as_view(),
    name="medicine-detail",
    ),
    
    path(
    "roles/",
    RoleListCreateView.as_view(),
    name="role-list-create",
    ),

    path(
    "roles/<int:pk>/",
    RoleDetailView.as_view(),
    name="role-detail",
    ),

    path(
    "users/",
    UserListCreateView.as_view(),
    name="user-list-create",
    ),

    path(
    "users/<int:pk>/",
    UserDetailView.as_view(),
    name="user-detail",
    ),

]