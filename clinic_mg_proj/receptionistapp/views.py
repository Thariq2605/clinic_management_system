from decimal import Decimal

from django.contrib.auth.hashers import check_password
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from core.models import Appointment, Bill, Department, Doctor, Patient, Receptionist, Staff, User
from .permissions import IsReceptionistSession, ReceptionistSessionAuthentication
from .serializers import (AppointmentCreateSerializer, AppointmentSerializer,
                          DepartmentSerializer, DoctorSerializer, PatientSearchSerializer,
                          PatientSerializer, PaymentInputSerializer)
from .services import AppointmentRuleError, create_appointment


@api_view(["GET"])
def csrf_token(request):
    return Response({"csrfToken": get_token(request)})


@csrf_protect
@api_view(["POST"])
def receptionist_login(request):
    username, password = request.data.get("username"), request.data.get("password")
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)
    user = User.objects.select_related("role").filter(
        username=username, is_active=True, role__is_active=True
    ).first()
    if user is None or not check_password(password, user.password):
        return Response({"error": "Invalid username or password."}, status=401)
    if user.role.role_name.casefold() != "receptionist":
        return Response({"error": "This account is not a receptionist account."}, status=403)
    staff = Staff.objects.filter(user=user, is_active=True).first()
    receptionist = Receptionist.objects.filter(staff=staff, is_active=True).first() if staff else None
    if receptionist is None:
        return Response({"error": "Active receptionist record was not found."}, status=403)
    request.session.flush()
    request.session["user_id"] = user.user_id
    request.session["receptionist_id"] = receptionist.receptionist_id
    return Response({"message": "Receptionist login successful.",
                     "user_id": user.user_id, "receptionist_id": receptionist.receptionist_id,
                     "name": staff.full_name})


@api_view(["POST"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def receptionist_logout(request):
    request.session.flush()
    return Response({"message": "Receptionist logged out."})


@api_view(["GET", "POST"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def patients(request):
    if request.method == "POST":
        serializer = PatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mobile = serializer.validated_data["mobile_number"].strip()
        email = serializer.validated_data["email"].strip().casefold()
        if Patient.objects.filter(mobile_number__iexact=mobile, email__iexact=email,
                                  is_active=True).exists():
            return Response({"error": "An active patient with this phone and email already exists."},
                            status=409)
        patient = serializer.save(mobile_number=mobile, email=email)
        return Response(PatientSerializer(patient).data, status=201)

    search = request.query_params.get("search", "").strip()
    patient_id = request.query_params.get("patient_id", "").strip()
    if not search and not patient_id:
        return Response({"search": "Provide a patient_id or search term."}, status=400)
    rows = Patient.objects.filter(is_active=True)
    if patient_id:
        if not patient_id.isdecimal() or int(patient_id) < 1:
            return Response({"patient_id": "Must be a positive integer."}, status=400)
        rows = rows.filter(patient_id=int(patient_id))
    if search:
        rows = rows.filter(Q(full_name__icontains=search) |
                           Q(mobile_number__icontains=search) |
                           Q(email__icontains=search))
    return Response(PatientSearchSerializer(rows.order_by("patient_id")[:100], many=True).data)


@api_view(["GET"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def departments(request):
    rows = Department.objects.filter(is_active=True).order_by("department_name")
    return Response(DepartmentSerializer(rows, many=True).data)


@api_view(["GET"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def doctors(request):
    rows = Doctor.objects.filter(is_active=True, staff__is_active=True,
                                 department__is_active=True)
    department = request.query_params.get("department", "").strip()
    if department:
        if not department.isdecimal() or int(department) < 1:
            return Response({"department": "Must be a positive integer."}, status=400)
        rows = rows.filter(department_id=int(department))
    rows = rows.select_related("staff", "department").order_by("doctor_id")
    return Response(DoctorSerializer(rows, many=True).data)


@api_view(["GET"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def doctor_availability(request, doctor_id):
    doctor = Doctor.objects.filter(doctor_id=doctor_id, is_active=True,
                                   staff__is_active=True, department__is_active=True).first()
    if doctor is None:
        return Response({"error": "Active doctor was not found."}, status=404)
    return Response({"doctor_id": doctor_id, "consultation_fee": str(doctor.consultation_fee),
                     "availability_supported": False, "availability": None,
                     "message": "No doctor schedule model exists in this project."})


@api_view(["GET", "POST"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def appointments(request):
    receptionist = Receptionist.objects.select_related("staff").filter(
        receptionist_id=request.session["receptionist_id"], is_active=True,
        staff__is_active=True).first()
    if receptionist is None:
        return Response({"error": "Active receptionist record was not found."}, status=403)

    if request.method == "POST":
        serializer = AppointmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            appointment = create_appointment(
                patient=data["patient"], department_id=data["department"].department_id,
                doctor_id=data["doctor"].doctor_id, appointment_date=data["appointment_date"],
                appointment_time=data["appointment_time"], reason=data["reason"],
                receptionist=receptionist)
        except AppointmentRuleError as exc:
            return Response({"error": exc.detail}, status=exc.status_code)
        except IntegrityError:
            return Response({"error": "Appointment or bill conflicts with existing data."}, status=409)
        return Response(AppointmentSerializer(appointment).data, status=201)

    rows = Appointment.objects.filter(receptionist=receptionist, is_active=True).select_related(
        "patient", "doctor", "doctor__staff", "doctor__department"
    ).prefetch_related("bill_set")
    date_value = request.query_params.get("date")
    if date_value:
        try:
            date_value = serializers.DateField().run_validation(date_value)
        except serializers.ValidationError as exc:
            return Response({"date": exc.detail}, status=400)
        rows = rows.filter(appointment_date=date_value)
    rows = rows.order_by("appointment_date", "doctor_id", "token_number")
    return Response(AppointmentSerializer(rows, many=True).data)


@api_view(["PATCH"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def cancel_appointment(request, appointment_id):
    try:
        with transaction.atomic():
            appointment = Appointment.objects.select_for_update().select_related(
                "patient", "doctor", "doctor__staff", "doctor__department"
            ).get(appointment_id=appointment_id,
                  receptionist_id=request.session["receptionist_id"], is_active=True)
            if appointment.status not in ("scheduled", "confirmed"):
                return Response({"error": "Only scheduled or confirmed appointments can be cancelled."},
                                status=409)
            bills = list(Bill.objects.select_for_update().filter(appointment=appointment, is_active=True))
            if any(bill.payment_set.filter(is_active=True).exists() for bill in bills):
                return Response({"error": "An appointment with recorded payments cannot be cancelled."},
                                status=409)
            appointment.status = "cancelled"
            appointment.save(update_fields=["status"])
            for bill in bills:
                bill.is_active = False
                bill.save(update_fields=["is_active"])
    except Appointment.DoesNotExist:
        return Response({"error": "Appointment was not found."}, status=404)
    return Response(AppointmentSerializer(appointment).data)


@api_view(["POST"])
@authentication_classes([ReceptionistSessionAuthentication])
@permission_classes([IsReceptionistSession])
def record_payment(request, appointment_id):
    serializer = PaymentInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            appointment = Appointment.objects.select_for_update().get(
                appointment_id=appointment_id, is_active=True,
                receptionist_id=request.session["receptionist_id"])
            bills = list(Bill.objects.select_for_update().filter(
                appointment=appointment, is_active=True))
            if not bills:
                return Response({"error": "Active appointment bill was not found."}, status=404)
            if len(bills) != 1:
                return Response({"error": "Appointment has multiple active bills."}, status=409)
            bill = bills[0]
            paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"]
            paid = paid or Decimal("0.00")
            amount = serializer.validated_data["amount"]
            if paid + amount > bill.total_amount:
                return Response({"amount": "Payment exceeds the outstanding balance."}, status=400)
            payment = serializer.save(bill=bill, payment_date=timezone.now())
            paid += amount
            bill.payment_status = "paid" if paid == bill.total_amount else "partial"
            bill.save(update_fields=["payment_status"])
            appointment.payment_status = "Paid" if bill.payment_status == "paid" else "Pending"
            appointment.save(update_fields=["payment_status"])
    except Appointment.DoesNotExist:
        return Response({"error": "Appointment was not found."}, status=404)
    return Response({"payment_id": payment.payment_id, "bill_id": bill.bill_id,
                     "bill_payment_status": bill.payment_status,
                     "appointment_payment_status": appointment.payment_status,
                     "paid_total": str(paid), "balance": str(bill.total_amount - paid)}, status=201)
