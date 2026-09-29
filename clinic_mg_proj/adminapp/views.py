from rest_framework import generics

from core.models import Staff, Department, Doctor, Medicine, Role, User

from .serializers import StaffSerializer, DepartmentSerializer, DoctorSerializer, MedicineSerializer, RoleSerializer, UserSerializer

from rest_framework.permissions import IsAuthenticated

from .permissions import IsAdministrator

class StaffListCreateView(generics.ListCreateAPIView):

    queryset = Staff.objects.all()

    serializer_class = StaffSerializer
    permission_classes = [IsAdministrator]


class StaffDetailView(generics.RetrieveUpdateAPIView):

    queryset = Staff.objects.all()

    serializer_class = StaffSerializer
    permission_classes = [IsAdministrator]


class DepartmentListCreateView(generics.ListCreateAPIView):

    queryset = Department.objects.all()

    serializer_class = DepartmentSerializer
    
    permission_classes = [IsAdministrator]


class DepartmentDetailView(generics.RetrieveUpdateAPIView):

    queryset = Department.objects.all()

    serializer_class = DepartmentSerializer
    
    permission_classes = [IsAdministrator]


class DoctorListCreateView(generics.ListCreateAPIView):

    queryset = Doctor.objects.all()

    serializer_class = DoctorSerializer
    
    permission_classes = [IsAdministrator]


class DoctorDetailView(generics.RetrieveUpdateAPIView):

    queryset = Doctor.objects.all()

    serializer_class = DoctorSerializer
    
    permission_classes = [IsAdministrator]
    
    
class MedicineListCreateView(generics.ListCreateAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    
    permission_classes = [IsAdministrator]


class MedicineDetailView(generics.RetrieveUpdateAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    
    permission_classes = [IsAdministrator]
    
class RoleListCreateView(generics.ListCreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    
    permission_classes = [IsAdministrator]


class RoleDetailView(generics.RetrieveUpdateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    
    permission_classes = [IsAdministrator]


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    permission_classes = [IsAdministrator]


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    permission_classes = [IsAdministrator]