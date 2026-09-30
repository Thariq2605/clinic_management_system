from django.db import transaction
from django.utils import timezone

from core.models import Appointment, Bill, Doctor


class AppointmentRuleError(Exception):
    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


@transaction.atomic
def create_appointment(*, patient, department_id, doctor_id, appointment_date,
                       appointment_time, reason, receptionist):
    # Doctor-row locking serializes token allocation on supporting databases.
    try:
        doctor = Doctor.objects.select_for_update().select_related("department", "staff").get(
            doctor_id=doctor_id, department_id=department_id, is_active=True,
            staff__is_active=True, department__is_active=True,
        )
    except Doctor.DoesNotExist:
        raise AppointmentRuleError("Active doctor was not found for the selected department.", 404)

    now = timezone.localtime()
    if appointment_date < now.date():
        raise AppointmentRuleError("Appointment date cannot be in the past.")
    if appointment_date == now.date() and appointment_time <= now.time().replace(tzinfo=None):
        raise AppointmentRuleError("Appointment time must be in the future.")

    # Prevent duplicate booking for the same doctor at the same date and time
    if Appointment.objects.filter(
        doctor=doctor,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
    ).exclude(status="cancelled").exists():
        raise AppointmentRuleError("Doctor is already booked for this appointment time.", 409)

    # Prevent duplicate booking for the same patient at the same date and time
    if Appointment.objects.filter(
        patient=patient,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
    ).exclude(status="cancelled").exists():
        raise AppointmentRuleError("Patient already has an appointment at this date and time.", 409)

    used = set(Appointment.objects.filter(
        doctor=doctor, appointment_date=appointment_date
    ).values_list("token_number", flat=True))
    token = 1
    while str(token) in used:
        token += 1
    if len(str(token)) > 10:
        raise AppointmentRuleError("No token number can be represented for this date.", 409)

    appointment = Appointment.objects.create(
        patient=patient, doctor=doctor, receptionist=receptionist,
        appointment_date=appointment_date, appointment_time=appointment_time,
        token_number=str(token), reason=reason, status="scheduled",
        payment_status="Pending", created_at=timezone.now(),
    )
    Bill.objects.create(
        patient=patient, appointment=appointment, total_amount=doctor.consultation_fee,
        bill_date=appointment_date, payment_status="pending", created_by=receptionist.staff,
    )
    return appointment
