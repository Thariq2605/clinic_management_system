from django.contrib.auth.hashers import check_password

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import User, Staff, Doctor, Appointment,Consultation,Prescription,PrescriptionMedicine,PrescriptionLabTest,MedicalRecord
from .serializer import AppointmentSerializer,PatientDetailsSerializer,ConsultationSerializer,PrescriptionSerializer,PrescriptionMedicineSerializer,PrescriptionLabTestSerializer,MedicalRecordSerializer


from datetime import date
from django.utils import timezone

from core.models import (
    Consultation,
    MedicalRecord
)

from .permission import IsDoctor

from .serializer import MedicalRecordSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_appointments(request, doctor_id):

    appointments = Appointment.objects.filter(
        doctor_id=doctor_id,
        appointment_date=date.today(),
        is_active=True
    ).order_by('appointment_time')

    serializer = AppointmentSerializer(
        appointments,
        many=True
    )

    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def doctor_login(request):

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {
                "error": "Username and password are required"
            },
            status=400
        )

    try:
        user = User.objects.get(
            username=username,
            is_active=True
        )
    except User.DoesNotExist:
        return Response(
            {
                "error": "Invalid username or password"
            },
            status=401
        )

    if not check_password(password, user.password):
        return Response(
            {
                "error": "Invalid username or password"
            },
            status=401
        )

    if user.role.role_name.lower() != "doctor":
        return Response(
            {
                "error": "This account is not a doctor account"
            },
            status=403
        )

    try:
        staff = Staff.objects.get(
            user=user,
            is_active=True
        )

        doctor = Doctor.objects.get(
            staff=staff,
            is_active=True
        )

    except Staff.DoesNotExist:
        return Response(
            {
                "error": "Staff record not found"
            },
            status=404
        )

    except Doctor.DoesNotExist:
        return Response(
            {
                "error": "Doctor record not found"
            },
            status=404
        )

    refresh = RefreshToken.for_user(user)
    refresh['doctor_id'] = doctor.doctor_id
    refresh['role'] = 'doctor'

    request.session['user_id'] = user.user_id
    request.session['doctor_id'] = doctor.doctor_id

    return Response(
        {
            "message": "Doctor login successful",
            "user_id": user.user_id,
            "doctor_id": doctor.doctor_id,
            "doctor_name": staff.full_name,
            "username": user.username,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
        status=200
    )

@api_view(['GET'])
def doctor_dashboard(request):

    # Get logged-in doctor's ID from session
    doctor_id = request.session.get('doctor_id')

    if not doctor_id:
        return Response(
            {
                "error": "Doctor is not logged in"
            },
            status=401
        )

    # Get doctor
    try:
        doctor = Doctor.objects.select_related(
            'staff',
            'specialization',
            'department'
        ).get(
            doctor_id=doctor_id,
            is_active=True
        )

    except Doctor.DoesNotExist:
        return Response(
            {
                "error": "Doctor not found"
            },
            status=404
        )

    # Today's date
    today = date.today()

    # Get today's appointments
    today_appointments = Appointment.objects.filter(
        doctor=doctor,
        appointment_date=today,
        is_active=True
    )

    # Appointment counts
    total_appointments = today_appointments.count()

    scheduled_appointments = today_appointments.filter(
        status='scheduled'
    ).count()

    confirmed_appointments = today_appointments.filter(
        status='confirmed'
    ).count()

    completed_appointments = today_appointments.filter(
        status='completed'
    ).count()

    return Response(
        {
            "doctor": {
                "doctor_id": doctor.doctor_id,
                "name": doctor.staff.full_name,
                "username": doctor.staff.user.username,
                "specialization": doctor.specialization.specialization_name,
                "department": doctor.department.department_name,
                "qualification": doctor.qualification,
                "experience_years": doctor.experience_years,
                "license_number": doctor.license_number,
                "consultation_fee": str(doctor.consultation_fee)
            },

            "today": str(today),

            "appointments": {
                "total": total_appointments,
                "scheduled": scheduled_appointments,
                "confirmed": confirmed_appointments,
                "completed": completed_appointments
            }
        },
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_dashboard(request, doctor_id):

    # Find doctor
    try:
        doctor = Doctor.objects.select_related(
            'staff',
            'specialization',
            'department'
        ).get(
            doctor_id=doctor_id,
            is_active=True
        )

    except Doctor.DoesNotExist:
        return Response(
            {
                "error": "Doctor not found"
            },
            status=404
        )

    # Today's date
    today = date.today()

    # Get today's active appointments
    appointments = Appointment.objects.filter(
        doctor=doctor,
        appointment_date=today,
        is_active=True
    )

    # Count appointments based on status
    total = appointments.count()

    scheduled = appointments.filter(
        status='scheduled'
    ).count()

    confirmed = appointments.filter(
        status='confirmed'
    ).count()

    completed = appointments.filter(
        status='completed'
    ).count()

    cancelled = appointments.filter(
        status='cancelled'
    ).count()

    return Response(
        {
            "doctor": {
                "doctor_id": doctor.doctor_id,
                "name": doctor.staff.full_name,
                "specialization": doctor.specialization.specialization_name,
                "department": doctor.department.department_name,
                "qualification": doctor.qualification,
                "experience_years": doctor.experience_years,
                "license_number": doctor.license_number,
                "consultation_fee": str(doctor.consultation_fee)
            },

            "date": str(today),

            "appointments": {
                "total": total,
                "scheduled": scheduled,
                "confirmed": confirmed,
                "completed": completed,
                "cancelled": cancelled
            }
        },
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def appointment_patient_details(request, doctor_id, appointment_id):

    try:
        appointment = Appointment.objects.select_related(
            'patient',
            'doctor'
        ).get(
            appointment_id=appointment_id,
            doctor_id=doctor_id,
            is_active=True
        )

    except Appointment.DoesNotExist:
        return Response(
            {
                "error": "Appointment not found."
            },
            status=404
        )

    # Find the active bill for this appointment
    bill = appointment.bill_set.filter(
        is_active=True
    ).first()

    if not bill:
        return Response(
            {
                "error": "Payment not completed. Please contact the Receptionist."
            },
            status=403
        )

    # Check payment status from Bill
    if bill.payment_status != "paid":
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist."
            },
            status=403
        )

    # Payment is completed
    patient = appointment.patient

    serializer = PatientDetailsSerializer(patient)

    return Response(
        {
            "appointment_id": appointment.appointment_id,
            "token_number": appointment.token_number,
            "payment_status": bill.payment_status,
            "patient": serializer.data
        },
        status=200
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsDoctor])
def create_consultation(request, doctor_id, appointment_id):

    # Find appointment belonging to this doctor
    try:
        appointment = Appointment.objects.select_related(
            'patient',
            'doctor'
        ).get(
            appointment_id=appointment_id,
            doctor_id=doctor_id,
            is_active=True
        )

    except Appointment.DoesNotExist:
        return Response(
            {
                "error": "Appointment not found."
            },
            status=404
        )

    # Find the bill associated with this appointment
    bill = appointment.bill_set.filter(
        is_active=True
    ).first()

    # No bill means payment is not completed
    if not bill:
        return Response(
            {
                "error": "Payment not completed. Please contact the Receptionist."
            },
            status=403
        )

    # Payment must be fully paid
    if bill.payment_status != "paid":
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist."
            },
            status=403
        )

    # Create consultation
    serializer = ConsultationSerializer(
        data=request.data
    )

    if serializer.is_valid():

        consultation = serializer.save(
            appointment=appointment,
            doctor=appointment.doctor,
            consultation_date=date.today()
        )

        return Response(
            ConsultationSerializer(consultation).data,
            status=201
        )

    return Response(
        serializer.errors,
        status=400
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsDoctor])
def create_prescription(request, doctor_id, consultation_id):

    # 1. Find the consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor_id=doctor_id,
            is_active=True
        )

    except Consultation.DoesNotExist:
        return Response(
            {
                "error": "Consultation not found."
            },
            status=404
        )

    # 2. Check payment
    appointment = consultation.appointment

    if appointment.payment_status != "Paid":
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist."
            },
            status=403
        )

    # 3. Get medicines from request
    medicines = request.data.get("medicines")

    if not medicines:
        return Response(
            {
                "error": "At least one medicine is required."
            },
            status=400
        )

    # 4. Create Prescription
    prescription = Prescription.objects.create(
        consultation=consultation,
        patient=appointment.patient,
        doctor=consultation.doctor,
        prescription_date=date.today()
    )

    # 5. Create PrescriptionMedicine records
    medicine_items = []

    for medicine_data in medicines:

        medicine_serializer = PrescriptionMedicineSerializer(
            data=medicine_data
        )

        if medicine_serializer.is_valid():

            medicine_item = medicine_serializer.save(
                prescription=prescription
            )

            medicine_items.append(
                PrescriptionMedicineSerializer(
                    medicine_item
                ).data
            )

        else:
            # Delete prescription if medicine data is invalid
            prescription.delete()

            return Response(
                medicine_serializer.errors,
                status=400
            )

    # 6. Return response
    return Response(
        {
            "prescription": PrescriptionSerializer(
                prescription
            ).data,

            "patient": {
                "patient_id": appointment.patient.patient_id,
                "full_name": appointment.patient.full_name
            },

            "medicines": medicine_items
        },
        status=201
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsDoctor])
def create_lab_test_request(request, doctor_id, consultation_id):

    # 1. Find the consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor_id=doctor_id,
            is_active=True
        )

    except Consultation.DoesNotExist:
        return Response(
            {
                "error": "Consultation not found."
            },
            status=404
        )

    # 2. Check payment
    appointment = consultation.appointment

    if appointment.payment_status != "Paid":
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist."
            },
            status=403
        )

    # 3. Find the prescription for this consultation
    prescription = Prescription.objects.filter(
        consultation=consultation,
        doctor_id=doctor_id,
        is_active=True
    ).first()

    if not prescription:
        return Response(
            {
                "error": "Prescription not found. Create a prescription first."
            },
            status=404
        )

    # 4. Validate lab test data
    serializer = PrescriptionLabTestSerializer(
        data=request.data
    )

    if serializer.is_valid():

        lab_test_request = serializer.save(
            prescription=prescription
        )

        return Response(
            {
                "prescription": prescription.prescription_id,
                "patient": {
                    "patient_id": appointment.patient.patient_id,
                    "full_name": appointment.patient.full_name
                },
                "lab_test": PrescriptionLabTestSerializer(
                    lab_test_request
                ).data
            },
            status=201
        )

    return Response(
        serializer.errors,
        status=400
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def patient_medical_history(request, doctor_id, patient_id):

    # Check whether this doctor has an active appointment
    # with this patient
    appointment_exists = Appointment.objects.filter(
        doctor_id=doctor_id,
        patient_id=patient_id,
        is_active=True
    ).exists()

    if not appointment_exists:
        return Response(
            {
                "error": "Patient is not associated with this doctor."
            },
            status=403
        )

    # Get patient's medical records
    records = MedicalRecord.objects.filter(
        patient_id=patient_id,
        is_active=True
    ).select_related(
        'doctor',
        'consultation'
    ).order_by('-created_at')

    serializer = MedicalRecordSerializer(
        records,
        many=True
    )

    return Response(
        {
            "patient_id": patient_id,
            "total_records": records.count(),
            "medical_history": serializer.data
        },
        status=200
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsDoctor])
def create_medical_record(request, doctor_id, consultation_id):

    # 1. Find consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor_id=doctor_id,
            is_active=True
        )

    except Consultation.DoesNotExist:
        return Response(
            {
                "error": "Consultation not found."
            },
            status=404
        )

    # 2. Check payment
    appointment = consultation.appointment

    if appointment.payment_status != "Paid":
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist."
            },
            status=403
        )

    # 3. Prevent duplicate medical records
    existing_record = MedicalRecord.objects.filter(
        consultation=consultation,
        is_active=True
    ).first()

    if existing_record:
        return Response(
            {
                "error": "Medical record already exists for this consultation."
            },
            status=400
        )

    # 4. Create medical record using consultation details
    medical_record = MedicalRecord.objects.create(
        patient=appointment.patient,
        doctor=consultation.doctor,
        consultation=consultation,
        diagnosis=consultation.diagnosis,
        medical_notes=consultation.notes,
        created_at=timezone.now()
    )

    # 5. Return response
    return Response(
        {
            "message": "Medical record created successfully.",
            "medical_record": MedicalRecordSerializer(
                medical_record
            ).data
        },
        status=201
    )
