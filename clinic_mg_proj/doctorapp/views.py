from datetime import date, timedelta

from django.contrib.auth.hashers import check_password
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    User,
    Staff,
    Doctor,
    Appointment,
    Consultation,
    Prescription,
    PrescriptionMedicine,
    PrescriptionLabTest,
    MedicalRecord,
    Medicine,
    LabTest,
)

from .serializer import (
    AppointmentSerializer,
    PatientDetailsSerializer,
    ConsultationSerializer,
    PrescriptionSerializer,
    PrescriptionMedicineSerializer,
    PrescriptionLabTestSerializer,
    MedicalRecordSerializer,
    LabTestSerializer,
    MedicineSerializer,
)

from doctorapp.permission import IsDoctor
from decimal import Decimal
from django.db.models import Q, Sum


def is_appointment_payment_completed(appointment):
    """
    Authoritative payment validation rule:
    An appointment is available to the Doctor for consultation / patient details ONLY IF:
    1. appointment.payment_status == 'Paid'
    2. An active bill is linked to the appointment
    3. bill.payment_status == 'paid'
    4. Outstanding balance is 0 (bill.total_amount - paid <= 0)
    """
    if not appointment:
        return False, "Appointment not found."

    if str(appointment.payment_status).strip().capitalize() != "Paid":
        return False, "Payment is pending. Doctor access will be available after payment is completed."

    bill = appointment.bill_set.filter(is_active=True).first()
    if not bill:
        return False, "Active bill was not found. Please contact Receptionist."

    if str(bill.payment_status).strip().lower() != "paid":
        return False, "Payment is pending. Doctor access will be available after payment is completed."

    paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    if bill.total_amount - paid > Decimal("0.00"):
        return False, "Payment is pending. Doctor access will be available after payment is completed."

    return True, None


def get_authenticated_doctor(request, doctor_id):

    try:
        doctor = Doctor.objects.select_related(
            'staff',
            'staff__user',
            'specialization',
            'department'
        ).get(
            doctor_id=doctor_id,
            staff__user_id=request.user.user_id,
            staff__is_active=True,
            is_active=True
        )

        return doctor

    except Doctor.DoesNotExist:
        return None

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_appointments(request, doctor_id):

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to access this doctor's appointments."
            },
            status=403
        )

    appointments = Appointment.objects.filter(
        doctor=doctor,
        appointment_date=date.today(),
        is_active=True
    ).select_related('patient').order_by('appointment_time')

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

    # Also set session variables for receptionist-compatible session auth
    request.session['user_id'] = user.user_id
    request.session['doctor_id'] = doctor.doctor_id

    access_token = refresh.access_token

    return Response(
        {
            "message": "Doctor login successful",
            "user_id": user.user_id,
            "doctor_id": doctor.doctor_id,
            "doctor_name": staff.full_name,
            "username": user.username,
            "access": str(access_token),
            "refresh": str(refresh),
        },
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_dashboard(request, doctor_id):

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to access this doctor's dashboard."
            },
            status=403
        )

    today = date.today()

    
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
    yesterday_appointments = Appointment.objects.filter(
        doctor=doctor,
        appointment_date=today - timedelta(days=1),
        is_active=True
    ).count()

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

    patients_seen = Consultation.objects.filter(
        doctor=doctor,
        consultation_date=today,
        is_active=True
    ).values('appointment__patient_id').distinct().count()

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
            },
            "patients_seen": patients_seen,
            "appointment_change": total_appointments - yesterday_appointments
        },
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def appointment_patient_details(request, doctor_id, appointment_id):

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to access this doctor's appointment."
            },
            status=403
        )


    try:
        appointment = Appointment.objects.select_related(
            'patient',
            'doctor'
        ).get(
            appointment_id=appointment_id,
            doctor=doctor,
            is_active=True
        )

    except Appointment.DoesNotExist:
        return Response(
            {
                "error": "Appointment not found."
            },
            status=404
        )

    # Check payment status
    is_paid, error_msg = is_appointment_payment_completed(appointment)
    if not is_paid:
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist.",
                "detail": "Payment is pending. Doctor access will be available after payment is completed."
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
            "payment_status": appointment.payment_status,
            "patient": serializer.data
        },
        status=200
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsDoctor])
def create_consultation(request, doctor_id, appointment_id):

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to create a consultation for this doctor."
            },
            status=403
        )

    # Find appointment belonging to this doctor
    try:
        appointment = Appointment.objects.select_related(
            'patient',
            'doctor'
        ).get(
            appointment_id=appointment_id,
            doctor=doctor,
            is_active=True
        )

    except Appointment.DoesNotExist:
        return Response(
            {
                "error": "Appointment not found."
            },
            status=404
        )

    # Check payment status
    is_paid, error_msg = is_appointment_payment_completed(appointment)
    if not is_paid:
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist.",
                "detail": "Payment is pending. Doctor access will be available after payment is completed."
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

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to create a prescription for this doctor."
            },
            status=403
        )

    # 1. Find the consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor=doctor,
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
    is_paid, error_msg = is_appointment_payment_completed(appointment)
    if not is_paid:
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist.",
                "detail": "Payment is pending. Doctor access will be available after payment is completed."
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


    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to request lab tests for this doctor."
            },
            status=403
        )

    # 1. Find the consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor=doctor,
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
    is_paid, error_msg = is_appointment_payment_completed(appointment)
    if not is_paid:
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist.",
                "detail": "Payment is pending. Doctor access will be available after payment is completed."
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
    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to access this doctor's patient history."
            },
            status=403
        )

    # Check whether this doctor has an active appointment
    # with this patient
    appointment_exists = Appointment.objects.filter(
        doctor=doctor,
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

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to create a medical record for this doctor."
            },
            status=403
        )

    # 1. Find consultation belonging to this doctor
    try:
        consultation = Consultation.objects.select_related(
            'appointment',
            'appointment__patient',
            'doctor'
        ).get(
            consultation_id=consultation_id,
            doctor=doctor,
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
    is_paid, error_msg = is_appointment_payment_completed(appointment)
    if not is_paid:
        return Response(
            {
                "error": "Payment is not completed. Please contact the Receptionist.",
                "detail": "Payment is pending. Doctor access will be available after payment is completed."
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

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def search_patients(request, doctor_id):

    doctor = get_authenticated_doctor(request, doctor_id)

    if not doctor:
        return Response(
            {
                "error": "You are not authorized to search patients."
            },
            status=403
        )

    search = request.GET.get('search', '').strip()

    if not search:
        return Response(
            {
                "error": "Search term is required."
            },
            status=400
        )

    # Find patients who have an appointment with this doctor
    appointments = Appointment.objects.filter(
        doctor=doctor,
        patient__is_active=True,
        is_active=True
    ).select_related('patient').order_by(
        '-appointment_date',
        '-appointment_time'
    )

    # Search by Patient ID, name or phone number
    appointments = appointments.filter(
        Q(patient__patient_id__icontains=search) |
        Q(patient__full_name__icontains=search) |
        Q(patient__mobile_number__icontains=search)
    )

    results = []

    seen_patients = set()

    for appointment in appointments:

        patient = appointment.patient

        if patient.patient_id in seen_patients:
            continue

        seen_patients.add(patient.patient_id)

        results.append({
            "patient_id": patient.patient_id,
            "full_name": patient.full_name,
            "dob": patient.dob,
            "gender": patient.gender,
            "mobile_number": patient.mobile_number,
            "email": patient.email,
            "appointment_id": appointment.appointment_id,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "token_number": appointment.token_number,
            "appointment_status": appointment.status,
            "payment_status": appointment.payment_status
        })

    if not results:
        return Response(
            {
                "message": "No patients found.",
                "results": []
            },
            status=200
        )

    return Response(
        {
            "results": results
        },
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def available_medicines(request):

    medicines = Medicine.objects.filter(
        is_active=True
    ).order_by('medicine_name')

    serializer = MedicineSerializer(
        medicines,
        many=True
    )

    return Response(serializer.data, status=200)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def available_lab_tests(request):

    lab_tests = LabTest.objects.filter(
        is_active=True
    ).order_by('test_name')

    serializer = LabTestSerializer(
        lab_tests,
        many=True
    )

    return Response(
        serializer.data,
        status=200
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_consultations(request, doctor_id):

    doctor = get_authenticated_doctor(
        request,
        doctor_id
    )

    if not doctor:
        return Response(
            {
                "error":
                "You are not authorized to access this doctor's consultations."
            },
            status=403
        )

    consultations = Consultation.objects.filter(
        doctor=doctor,
        is_active=True
    ).select_related(
        'appointment',
        'appointment__patient'
    ).order_by(
        '-consultation_date',
        '-consultation_id'
    )

    serializer = ConsultationSerializer(
        consultations,
        many=True
    )

    return Response(
        serializer.data,
        status=200
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_medical_history(request, doctor_id):
    doctor = get_authenticated_doctor(request, doctor_id)
    if not doctor:
        return Response({'error': 'You are not authorized to access this medical history.'}, status=403)

    patient_id = request.GET.get('patient_id')
    if patient_id and not patient_id.isdigit():
        return Response({'error': 'Patient ID must be a positive integer.'}, status=400)
    records = MedicalRecord.objects.filter(doctor=doctor, is_active=True).select_related(
        'patient', 'consultation'
    ).order_by('-created_at')
    consultations = Consultation.objects.filter(
        doctor=doctor, is_active=True, appointment__is_active=True
    ).select_related('appointment', 'appointment__patient').order_by(
        '-consultation_date', '-consultation_id'
    )
    prescriptions = Prescription.objects.filter(
        doctor=doctor, is_active=True
    ).select_related('patient', 'consultation').prefetch_related(
        'prescriptionmedicine_set__medicine'
    ).order_by('-prescription_date', '-prescription_id')
    lab_requests = PrescriptionLabTest.objects.filter(
        prescription__doctor=doctor, prescription__is_active=True, is_active=True
    ).select_related('prescription', 'prescription__patient', 'prescription__consultation', 'test').order_by(
        '-prescription__prescription_date', '-prescription_lab_test_id'
    )
    if patient_id:
        records = records.filter(patient_id=patient_id)
        consultations = consultations.filter(appointment__patient_id=patient_id)
        prescriptions = prescriptions.filter(patient_id=patient_id)
        lab_requests = lab_requests.filter(prescription__patient_id=patient_id)

    prescription_data = []
    for prescription in prescriptions:
        item = PrescriptionSerializer(prescription).data
        item['medicines'] = PrescriptionMedicineSerializer(
            prescription.prescriptionmedicine_set.filter(is_active=True), many=True
        ).data
        prescription_data.append(item)

    return Response({
        'medical_history': MedicalRecordSerializer(records, many=True).data,
        'total_records': records.count(),
        'consultations': ConsultationSerializer(consultations, many=True).data,
        'prescriptions': prescription_data,
        'lab_tests': PrescriptionLabTestSerializer(lab_requests, many=True).data,
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_medical_records(request, doctor_id):
    doctor = get_authenticated_doctor(request, doctor_id)
    if not doctor:
        return Response({'error': 'You are not authorized to access these records.'}, status=403)
    records = MedicalRecord.objects.filter(doctor=doctor, is_active=True).select_related(
        'patient', 'consultation'
    ).order_by('-created_at')
    return Response(MedicalRecordSerializer(records, many=True).data, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_prescriptions(request, doctor_id):
    doctor = get_authenticated_doctor(request, doctor_id)
    if not doctor:
        return Response({'error': 'You are not authorized to access these prescriptions.'}, status=403)
    prescriptions = Prescription.objects.filter(doctor=doctor, is_active=True).select_related(
        'patient', 'consultation'
    ).prefetch_related('prescriptionmedicine_set__medicine').order_by('-prescription_date', '-prescription_id')
    results = []
    for prescription in prescriptions:
        item = PrescriptionSerializer(prescription).data
        item['medicines'] = PrescriptionMedicineSerializer(
            prescription.prescriptionmedicine_set.filter(is_active=True), many=True
        ).data
        results.append(item)
    return Response(results, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_lab_tests(request, doctor_id):
    doctor = get_authenticated_doctor(request, doctor_id)
    if not doctor:
        return Response({'error': 'You are not authorized to access these lab tests.'}, status=403)
    requests = PrescriptionLabTest.objects.filter(
        prescription__doctor=doctor, prescription__is_active=True, is_active=True
    ).select_related('prescription', 'prescription__patient', 'prescription__consultation', 'test').order_by(
        '-prescription__prescription_date', '-prescription_lab_test_id'
    )
    return Response(PrescriptionLabTestSerializer(requests, many=True).data, status=200)
