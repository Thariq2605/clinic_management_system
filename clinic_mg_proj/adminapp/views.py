from datetime import date, datetime, timedelta
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import (
    Staff,
    Department,
    Doctor,
    Medicine,
    Role,
    User,
    Receptionist,
    Specialization,
    Patient,
    Appointment,
    Consultation,
    Prescription,
    LabTest,
    LabOrder,
    Bill,
    Payment,
    ClinicSetting,
    MedicalRecord,
)

from .permissions import IsAdministrator
from .serializers import (
    StaffSerializer,
    DepartmentSerializer,
    DoctorSerializer,
    MedicineSerializer,
    RoleSerializer,
    UserSerializer,
    SpecializationSerializer,
    ReceptionistSerializer,
    PatientSerializer,
    AppointmentSerializer,
    LabTestSerializer,
    BillSerializer,
    PaymentSerializer,
    ClinicSettingSerializer,
)


class BaseAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdministrator]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except Exception:
            if hasattr(instance, "is_active"):
                instance.is_active = False
                instance.save()
            else:
                raise


# =========================================================
# CURRENT LOGGED-IN ADMIN USER
# =========================================================

class AdminCurrentUserView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        user = request.user
        full_name = user.username.capitalize()
        department = ""

        staff = Staff.objects.filter(user=user).first()
        if staff:
            full_name = staff.full_name
            if staff.department:
                department = staff.department.department_name

        return Response({
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role.role_name if user.role else "Administrator",
            "full_name": full_name,
            "department": department,
            "is_active": user.is_active,
        })


# =========================================================
# ROLES & USERS
# =========================================================

class RoleListCreateView(generics.ListCreateAPIView):
    queryset = Role.objects.all().order_by("role_id")
    serializer_class = RoleSerializer
    permission_classes = [IsAdministrator]


class RoleDetailView(BaseAdminDetailView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer


class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = User.objects.select_related("role").all().order_by("-user_id")
        role = self.request.query_params.get("role")
        status_param = self.request.query_params.get("status")
        search = self.request.query_params.get("search")

        if role:
            queryset = queryset.filter(role__role_name__iexact=role)
        if status_param is not None and status_param != "":
            if status_param.lower() == "active":
                queryset = queryset.filter(is_active=True)
            elif status_param.lower() == "inactive":
                queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(Q(username__icontains=search))
        return queryset


class UserDetailView(BaseAdminDetailView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


# =========================================================
# DEPARTMENTS
# =========================================================

class DepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Department.objects.all().order_by("department_id")
        search = self.request.query_params.get("search")
        status_param = self.request.query_params.get("status")

        if search:
            queryset = queryset.filter(
                Q(department_name__icontains=search) | Q(description__icontains=search)
            )
        if status_param is not None and status_param != "":
            if status_param.lower() == "active":
                queryset = queryset.filter(is_active=True)
            elif status_param.lower() == "inactive":
                queryset = queryset.filter(is_active=False)
        return queryset


class DepartmentDetailView(BaseAdminDetailView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


# =========================================================
# SPECIALIZATIONS
# =========================================================

class SpecializationListCreateView(generics.ListCreateAPIView):
    serializer_class = SpecializationSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Specialization.objects.all().order_by("specialization_id")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(specialization_name__icontains=search)
        return queryset


class SpecializationDetailView(BaseAdminDetailView):
    queryset = Specialization.objects.all()
    serializer_class = SpecializationSerializer


# =========================================================
# STAFF & RECEPTIONISTS
# =========================================================

class StaffListCreateView(generics.ListCreateAPIView):
    serializer_class = StaffSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Staff.objects.select_related("user", "department", "user__role").all().order_by("-staff_id")
        role = self.request.query_params.get("role")
        department = self.request.query_params.get("department")
        search = self.request.query_params.get("search")

        if role:
            queryset = queryset.filter(user__role__role_name__iexact=role)
        if department:
            queryset = queryset.filter(department_id=department)
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(email__icontains=search) | Q(mobile_number__icontains=search)
            )
        return queryset


class StaffDetailView(BaseAdminDetailView):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer


class ReceptionistListCreateView(generics.ListCreateAPIView):
    serializer_class = ReceptionistSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Receptionist.objects.select_related("staff", "staff__department").all().order_by("-receptionist_id")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(staff__full_name__icontains=search)
                | Q(staff__email__icontains=search)
                | Q(staff__mobile_number__icontains=search)
            )
        return queryset


class ReceptionistDetailView(BaseAdminDetailView):
    queryset = Receptionist.objects.all()
    serializer_class = ReceptionistSerializer


# =========================================================
# DOCTORS
# =========================================================

class DoctorListCreateView(generics.ListCreateAPIView):
    serializer_class = DoctorSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Doctor.objects.select_related("staff", "department", "specialization").all().order_by("-doctor_id")
        dept = self.request.query_params.get("department")
        spec = self.request.query_params.get("specialization")
        status_param = self.request.query_params.get("status")
        search = self.request.query_params.get("search")

        if dept:
            queryset = queryset.filter(department_id=dept)
        if spec:
            queryset = queryset.filter(specialization_id=spec)
        if status_param is not None and status_param != "":
            if status_param.lower() == "active":
                queryset = queryset.filter(is_active=True)
            elif status_param.lower() == "inactive":
                queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(
                Q(staff__full_name__icontains=search)
                | Q(license_number__icontains=search)
                | Q(qualification__icontains=search)
            )
        return queryset


class DoctorDetailView(BaseAdminDetailView):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer


# =========================================================
# MEDICINES
# =========================================================

class MedicineListCreateView(generics.ListCreateAPIView):
    serializer_class = MedicineSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Medicine.objects.all().order_by("medicine_id")
        search = self.request.query_params.get("search")
        stock_status = self.request.query_params.get("stock_status")

        if search:
            queryset = queryset.filter(
                Q(medicine_name__icontains=search) | Q(manufacturer__icontains=search)
            )
        if stock_status:
            today = date.today()
            if stock_status.lower() == "expired":
                queryset = queryset.filter(expiry_date__lte=today)
            elif stock_status.lower() == "low stock":
                queryset = queryset.filter(quantity__lte=15, expiry_date__gt=today)
            elif stock_status.lower() == "available":
                queryset = queryset.filter(quantity__gt=15, expiry_date__gt=today)
        return queryset


class MedicineDetailView(BaseAdminDetailView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer


# =========================================================
# PATIENTS
# =========================================================

class PatientListCreateView(generics.ListCreateAPIView):
    serializer_class = PatientSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Patient.objects.all().order_by("-patient_id")
        search = self.request.query_params.get("search")
        gender = self.request.query_params.get("gender")
        blood_group = self.request.query_params.get("blood_group")
        status_param = self.request.query_params.get("status")

        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(mobile_number__icontains=search)
                | Q(email__icontains=search)
            )
        if gender:
            queryset = queryset.filter(gender__iexact=gender)
        if blood_group:
            queryset = queryset.filter(blood_group__iexact=blood_group)
        if status_param is not None and status_param != "":
            if status_param.lower() == "active":
                queryset = queryset.filter(is_active=True)
            elif status_param.lower() == "inactive":
                queryset = queryset.filter(is_active=False)
        return queryset


class PatientDetailView(BaseAdminDetailView):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer


class PatientProfileView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request, pk):
        try:
            patient = Patient.objects.get(pk=pk)
        except Patient.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        patient_data = PatientSerializer(patient).data

        appointments = Appointment.objects.filter(patient=patient).order_by("-appointment_date")
        appointments_data = AppointmentSerializer(appointments, many=True).data

        prescriptions = Prescription.objects.filter(patient=patient).select_related("doctor", "doctor__staff").order_by("-prescription_date")
        prescriptions_data = []
        for p in prescriptions:
            prescriptions_data.append({
                "prescription_id": p.prescription_id,
                "doctor_name": p.doctor.staff.full_name if p.doctor and p.doctor.staff else "Doctor",
                "date": p.prescription_date,
                "items": [
                    {
                        "medicine": pm.medicine.medicine_name,
                        "dosage": pm.dosage,
                        "frequency": pm.frequency,
                        "duration": pm.duration,
                        "instructions": pm.instructions,
                    }
                    for pm in p.prescriptionmedicine_set.all()
                ],
            })

        medical_records = MedicalRecord.objects.filter(patient=patient).order_by("-created_at")
        records_data = [
            {
                "record_id": mr.record_id,
                "doctor_name": mr.doctor.staff.full_name if mr.doctor and mr.doctor.staff else "Doctor",
                "diagnosis": mr.diagnosis,
                "notes": mr.medical_notes,
                "date": mr.created_at,
            }
            for mr in medical_records
        ]

        bills = Bill.objects.filter(patient=patient).order_by("-bill_date")
        bills_data = BillSerializer(bills, many=True).data

        return Response({
            "patient": patient_data,
            "appointments": appointments_data,
            "prescriptions": prescriptions_data,
            "medical_records": records_data,
            "bills": bills_data,
        })


# =========================================================
# APPOINTMENTS
# =========================================================

class AppointmentListCreateView(generics.ListCreateAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Appointment.objects.select_related(
            "patient", "doctor", "doctor__staff", "doctor__department", "receptionist", "receptionist__staff"
        ).all().order_by("-appointment_date", "-appointment_time")

        search = self.request.query_params.get("search")
        doctor_id = self.request.query_params.get("doctor")
        status_param = self.request.query_params.get("status")
        date_param = self.request.query_params.get("date")

        if search:
            queryset = queryset.filter(
                Q(patient__full_name__icontains=search)
                | Q(token_number__icontains=search)
                | Q(doctor__staff__full_name__icontains=search)
            )
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if status_param:
            queryset = queryset.filter(status__iexact=status_param)
        if date_param:
            if date_param.lower() == "today":
                queryset = queryset.filter(appointment_date=date.today())
            else:
                queryset = queryset.filter(appointment_date=date_param)
        return queryset


class AppointmentDetailView(BaseAdminDetailView):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer


# =========================================================
# BILLING & PAYMENTS
# =========================================================

class BillListCreateView(generics.ListCreateAPIView):
    serializer_class = BillSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Bill.objects.select_related("patient", "appointment", "created_by").all().order_by("-bill_date", "-bill_id")
        search = self.request.query_params.get("search")
        payment_status = self.request.query_params.get("payment_status")
        date_param = self.request.query_params.get("date")

        if search:
            queryset = queryset.filter(
                Q(patient__full_name__icontains=search) | Q(bill_id__icontains=search)
            )
        if payment_status:
            queryset = queryset.filter(payment_status__iexact=payment_status)
        if date_param:
            queryset = queryset.filter(bill_date=date_param)
        return queryset


class BillDetailView(BaseAdminDetailView):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer


class PaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = Payment.objects.select_related("bill", "bill__patient").all().order_by("-payment_date", "-payment_id")
        search = self.request.query_params.get("search")
        method = self.request.query_params.get("payment_method")

        if search:
            queryset = queryset.filter(
                Q(bill__patient__full_name__icontains=search)
                | Q(transaction_reference__icontains=search)
                | Q(bill__bill_id__icontains=search)
            )
        if method:
            queryset = queryset.filter(payment_method__iexact=method)
        return queryset


class PaymentDetailView(BaseAdminDetailView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer


# =========================================================
# LAB TESTS
# =========================================================

class LabTestListCreateView(generics.ListCreateAPIView):
    serializer_class = LabTestSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        queryset = LabTest.objects.all().order_by("test_id")
        search = self.request.query_params.get("search")
        test_type = self.request.query_params.get("test_type")
        status_param = self.request.query_params.get("status")

        if search:
            queryset = queryset.filter(
                Q(test_name__icontains=search) | Q(test_type__icontains=search)
            )
        if test_type:
            queryset = queryset.filter(test_type__iexact=test_type)
        if status_param is not None and status_param != "":
            if status_param.lower() == "active":
                queryset = queryset.filter(is_active=True)
            elif status_param.lower() == "inactive":
                queryset = queryset.filter(is_active=False)
        return queryset


class LabTestDetailView(BaseAdminDetailView):
    queryset = LabTest.objects.all()
    serializer_class = LabTestSerializer


# =========================================================
# DASHBOARD AGGREGATION API
# =========================================================

class AdminDashboardView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        today = date.today()

        total_doctors = Doctor.objects.filter(is_active=True).count()
        total_receptionists = Receptionist.objects.filter(is_active=True).count()
        total_patients = Patient.objects.filter(is_active=True).count()
        todays_appointments = Appointment.objects.filter(appointment_date=today, is_active=True).count()

        # Pending payments total amount
        pending_bills = Bill.objects.filter(payment_status__in=["pending", "partial"], is_active=True)
        pending_payments_total = sum(
            (b.total_amount - sum(p.amount for p in b.payment_set.filter(is_active=True)))
            for b in pending_bills
        )

        pending_lab_orders = LabOrder.objects.filter(status="pending", is_active=True).count()
        active_prescriptions = Prescription.objects.filter(is_active=True).count()

        # Weekly appointment stats (Mon to Sun)
        current_weekday = today.weekday()
        week_start = today - timedelta(days=current_weekday)
        week_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly_appointments = []
        for i, day_name in enumerate(week_days):
            day_date = week_start + timedelta(days=i)
            cnt = Appointment.objects.filter(appointment_date=day_date, is_active=True).count()
            weekly_appointments.append({
                "day": day_name,
                "date": str(day_date),
                "count": cnt,
                "is_today": day_date == today,
            })

        # Payment donut stats
        paid_bills_count = Bill.objects.filter(payment_status="paid", is_active=True).count()
        pending_bills_count = Bill.objects.filter(payment_status__in=["pending", "partial"], is_active=True).count()
        overdue_bills_count = Bill.objects.filter(
            payment_status__in=["pending", "partial"],
            bill_date__lt=today - timedelta(days=30),
            is_active=True,
        ).count()
        total_bills = Bill.objects.filter(is_active=True).count() or 1

        # Recent appointments
        recent_appointments_qs = (
            Appointment.objects.select_related("patient", "doctor", "doctor__staff")
            .filter(is_active=True)
            .order_by("-appointment_date", "-appointment_time")[:5]
        )
        recent_appointments = [
            {
                "appointment_id": a.appointment_id,
                "patient_name": a.patient.full_name if a.patient else "Patient",
                "patient_initials": "".join([p[0] for p in a.patient.full_name.split()[:2]]).upper() if a.patient else "PT",
                "doctor_name": a.doctor.staff.full_name if a.doctor and a.doctor.staff else "Doctor",
                "appointment_date": str(a.appointment_date),
                "appointment_time": a.appointment_time.strftime("%I:%M %p") if a.appointment_time else "",
                "status": a.status,
                "payment_status": a.payment_status,
            }
            for a in recent_appointments_qs
        ]

        # Recent activities
        recent_activities = []
        # From payments
        for p in Payment.objects.select_related("bill", "bill__patient").order_by("-payment_date")[:3]:
            recent_activities.append({
                "type": "payment",
                "icon": "▤",
                "title": f"Payment received - {p.bill.patient.full_name if p.bill and p.bill.patient else ''}",
                "subtitle": f"${p.amount} · {p.payment_method.upper()}",
                "timestamp": p.payment_date,
            })
        # From appointments
        for a in Appointment.objects.select_related("doctor", "doctor__staff", "patient").order_by("-created_at")[:3]:
            recent_activities.append({
                "type": "appointment",
                "icon": "▣",
                "title": f"Appointment booked - {a.patient.full_name if a.patient else ''}",
                "subtitle": f"Dr. {a.doctor.staff.full_name if a.doctor and a.doctor.staff else ''} · {a.status.capitalize()}",
                "timestamp": a.created_at,
            })

        recent_activities.sort(key=lambda x: str(x["timestamp"]), reverse=True)
        recent_activities = recent_activities[:5]

        return Response({
            "total_doctors": total_doctors,
            "total_receptionists": total_receptionists,
            "total_patients": total_patients,
            "todays_appointments": todays_appointments,
            "pending_payments": round(pending_payments_total, 2),
            "pending_lab_orders": pending_lab_orders,
            "active_prescriptions": active_prescriptions,
            "weekly_appointments": weekly_appointments,
            "payment_stats": {
                "paid_count": paid_bills_count,
                "pending_count": pending_bills_count,
                "overdue_count": overdue_bills_count,
                "total_bills": total_bills,
                "paid_pct": round((paid_bills_count / total_bills) * 100, 1),
                "pending_pct": round((pending_bills_count / total_bills) * 100, 1),
                "overdue_pct": round((overdue_bills_count / total_bills) * 100, 1),
            },
            "recent_appointments": recent_appointments,
            "recent_activities": recent_activities,
        })


# =========================================================
# REPORTS AGGREGATION API
# =========================================================

class AdminReportsView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        today = date.today()
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except ValueError:
                start_date = today - timedelta(days=30)
        else:
            start_date = today - timedelta(days=30)

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                end_date = today
        else:
            end_date = today

        # Appointments
        app_qs = Appointment.objects.filter(
            appointment_date__range=[start_date, end_date], is_active=True
        )
        total_appointments = app_qs.count()
        completed_appointments = app_qs.filter(status="completed").count()
        cancelled_appointments = app_qs.filter(status="cancelled").count()
        scheduled_appointments = app_qs.filter(status__in=["scheduled", "confirmed"]).count()

        # Patients
        total_patients = Patient.objects.filter(is_active=True).count()
        gender_stats = list(
            Patient.objects.filter(is_active=True)
            .values("gender")
            .annotate(count=Count("patient_id"))
        )

        # Revenue
        bill_qs = Bill.objects.filter(bill_date__range=[start_date, end_date], is_active=True)
        total_billed = bill_qs.aggregate(Sum("total_amount"))["total_amount__sum"] or 0
        payment_qs = Payment.objects.filter(
            payment_date__date__range=[start_date, end_date], is_active=True
        )
        total_collected = payment_qs.aggregate(Sum("amount"))["amount__sum"] or 0
        total_pending = max(0, float(total_billed) - float(total_collected))

        # Medicines
        total_medicines = Medicine.objects.filter(is_active=True).count()
        low_stock_medicines = Medicine.objects.filter(
            quantity__lte=15, expiry_date__gt=today, is_active=True
        ).count()
        expired_medicines = Medicine.objects.filter(
            expiry_date__lte=today, is_active=True
        ).count()
        inventory_value = sum(
            (m.unit_price * m.quantity) for m in Medicine.objects.filter(is_active=True)
        )

        # Lab Tests
        total_tests = LabTest.objects.filter(is_active=True).count()
        total_orders = LabOrder.objects.filter(
            order_date__range=[start_date, end_date], is_active=True
        ).count()
        completed_orders = LabOrder.objects.filter(
            order_date__range=[start_date, end_date], status="completed", is_active=True
        ).count()

        # Department Performance — appointments per department in the selected date range
        dept_qs = (
            app_qs
            .values("doctor__department__department_name")
            .annotate(appointments=Count("appointment_id"))
            .order_by("-appointments")
        )
        department_performance = [
            {
                "department": row["doctor__department__department_name"],
                "appointments": row["appointments"],
            }
            for row in dept_qs
            if row["doctor__department__department_name"]
        ]

        return Response({
            "date_range": {
                "start_date": str(start_date),
                "end_date": str(end_date),
            },
            "appointments": {
                "total": total_appointments,
                "completed": completed_appointments,
                "cancelled": cancelled_appointments,
                "scheduled": scheduled_appointments,
            },
            "financial": {
                "total_billed": float(total_billed),
                "total_collected": float(total_collected),
                "total_pending": float(total_pending),
            },
            "patients": {
                "total": total_patients,
                "gender_stats": gender_stats,
            },
            "medicines": {
                "total": total_medicines,
                "low_stock": low_stock_medicines,
                "expired": expired_medicines,
                "inventory_value": float(inventory_value),
            },
            "lab": {
                "total_tests": total_tests,
                "total_orders": total_orders,
                "completed_orders": completed_orders,
            },
            "department_performance": department_performance,
        })


# =========================================================
# CLINIC SETTINGS API
# =========================================================

class AdminSettingsView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        setting, _ = ClinicSetting.objects.get_or_create(
            setting_id=1,
            defaults={
                "clinic_name": "ClinixOne Care Operations",
                "clinic_email": "support@clinixone.com",
                "clinic_phone": "+1 (800) 555-0199",
                "clinic_address": "100 Medical Center Blvd, Suite 400",
                "timezone": "UTC",
                "currency": "USD",
                "appointment_slot_duration": 15,
                "enable_notifications": True,
                "enable_email_alerts": True,
            },
        )
        serializer = ClinicSettingSerializer(setting)
        return Response(serializer.data)

    def post(self, request):
        setting, _ = ClinicSetting.objects.get_or_create(setting_id=1)
        serializer = ClinicSettingSerializer(setting, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.post(request)