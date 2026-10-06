from datetime import time, timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import Appointment, Bill, Doctor


# Default working hours: 08:00 AM to 08:00 PM (12-hour period)
DEFAULT_DOCTOR_WORKING_HOURS_START = time(8, 0)
DEFAULT_DOCTOR_WORKING_HOURS_END = time(20, 0)

# Doctor working-hours registry: doctor_id -> (start_time, end_time)
# Configured dynamically for each doctor.
DOCTOR_WORKING_HOURS = {
    1: (time(8, 0), time(20, 0)),   # Dr. mohamed thariq: 08:00 AM - 08:00 PM
    2: (time(10, 0), time(18, 0)),  # Dr. Anu: 10:00 AM - 06:00 PM
}


def get_doctor_working_hours(doctor):
    """
    Returns (start_time, end_time) for a doctor.
    Resolution priority:
    1. Custom attributes on the doctor instance (e.g. doctor.working_hours_start, doctor.working_hours_end)
    2. settings.DOCTOR_WORKING_HOURS mapping
    3. DOCTOR_WORKING_HOURS dictionary registry
    4. Default hours: 08:00 - 20:00
    """
    if hasattr(doctor, "working_hours_start") and hasattr(doctor, "working_hours_end"):
        return doctor.working_hours_start, doctor.working_hours_end
    if hasattr(doctor, "start_time") and hasattr(doctor, "end_time"):
        return doctor.start_time, doctor.end_time

    doc_id = getattr(doctor, "doctor_id", doctor)
    configured = getattr(settings, "DOCTOR_WORKING_HOURS", {}).get(doc_id)
    if configured:
        return configured

    if doc_id in DOCTOR_WORKING_HOURS:
        return DOCTOR_WORKING_HOURS[doc_id]

    return DEFAULT_DOCTOR_WORKING_HOURS_START, DEFAULT_DOCTOR_WORKING_HOURS_END


def get_doctor_display_name(doctor):
    if not doctor or not getattr(doctor, "staff", None):
        return "the doctor"
    name = doctor.staff.full_name.strip()
    if name.lower().startswith("dr.") or name.lower().startswith("dr "):
        return name
    return f"Dr. {name}"


class AppointmentRuleError(Exception):
    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


@transaction.atomic
def create_appointment(*, patient, department_id, doctor_id, appointment_date,
                       appointment_time, reason, receptionist, appointment_type="pre_booking"):
    # Backend Doctor Validation
    doctor_obj = Doctor.objects.select_related("staff", "staff__user", "department").filter(
        doctor_id=doctor_id
    ).first()
    if doctor_obj is None:
        raise AppointmentRuleError("Doctor was not found.", 404)
    if not doctor_obj.is_active or not doctor_obj.staff.is_active or not doctor_obj.staff.user.is_active:
        raise AppointmentRuleError("Doctor is not active.", 400)
    if not doctor_obj.department.is_active or doctor_obj.department_id != department_id:
        raise AppointmentRuleError("Doctor does not belong to the selected department.", 400)
    if Doctor.objects.filter(staff=doctor_obj.staff, is_active=True).count() > 1:
        raise AppointmentRuleError("Selected doctor has duplicate active records in the database.", 409)

    # Doctor-row locking serializes token allocation on supporting databases.
    doctor = Doctor.objects.select_for_update().select_related("department", "staff").get(
        doctor_id=doctor_id
    )

    now = timezone.localtime()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    max_prebooking_date = today + timedelta(days=10)
    current_time = now.time().replace(second=0, microsecond=0)

    if appointment_type == "walk_in":
        if appointment_date != today:
            raise AppointmentRuleError("Walk-In appointments can only be booked for today.", 400)
        if appointment_time.replace(second=0, microsecond=0) < current_time:
            raise AppointmentRuleError("Walk-In appointment time cannot be in the past.", 400)
    elif appointment_type == "pre_booking":
        if appointment_date < tomorrow:
            raise AppointmentRuleError("Pre-Booking is only available from tomorrow onwards. Please use Walk-In for today's appointments.", 400)
        if appointment_date > max_prebooking_date:
            raise AppointmentRuleError("Pre-Booking appointments can only be made up to 10 days in advance.", 400)
    else:
        raise AppointmentRuleError(f"Invalid appointment type: {appointment_type}.", 400)

    # Doctor Working-Hours Validation (start and end times are inclusive)
    start_time, end_time = get_doctor_working_hours(doctor)
    app_time_cmp = appointment_time.replace(second=0, microsecond=0)
    start_time_cmp = start_time.replace(second=0, microsecond=0)
    end_time_cmp = end_time.replace(second=0, microsecond=0)

    if app_time_cmp < start_time_cmp or app_time_cmp > end_time_cmp:
        doc_name = get_doctor_display_name(doctor)
        start_str = start_time_cmp.strftime("%I:%M %p")
        end_str = end_time_cmp.strftime("%I:%M %p")
        raise AppointmentRuleError(
            f"Appointment time must be within {doc_name}'s working hours ({start_str} - {end_str}).", 400
        )

    # 1. Exact Duplicate: Same patient + same doctor + same date and time
    if Appointment.objects.filter(
        patient=patient,
        doctor=doctor,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
    ).exclude(status="cancelled").exists():
        raise AppointmentRuleError("This patient already has an appointment with this doctor at this time.", 409)

    # 2. Doctor Time Conflict: Same doctor + same date and time
    if Appointment.objects.filter(
        doctor=doctor,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
    ).exclude(status="cancelled").exists():
        raise AppointmentRuleError("Doctor is already booked for this appointment time.", 409)

    # 3. Patient Time Conflict: Same patient + same date and time
    if Appointment.objects.filter(
        patient=patient,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
    ).exclude(status="cancelled").exists():
        raise AppointmentRuleError("Patient already has an appointment at this date and time.", 409)

    # Doctor-wise and date-wise token numbering
    existing_tokens = [
        int(t) for t in Appointment.objects.filter(
            doctor=doctor, appointment_date=appointment_date
        ).values_list("token_number", flat=True)
        if str(t).isdigit()
    ]
    highest_token = max(existing_tokens) if existing_tokens else 0
    token = highest_token + 1

    # Guarantee uniqueness for same doctor and same appointment date
    while Appointment.objects.filter(
        doctor=doctor, appointment_date=appointment_date, token_number=str(token)
    ).exists():
        token += 1

    if len(str(token)) > 10:
        raise AppointmentRuleError("No token number can be represented for this date.", 409)

    appointment = Appointment.objects.create(
        patient=patient, doctor=doctor, receptionist=receptionist,
        appointment_date=appointment_date, appointment_time=appointment_time,
        token_number=str(token), reason=reason, status="scheduled",
        payment_status="Pending", created_at=timezone.now(),
        appointment_type=appointment_type,
    )
    Bill.objects.create(
        patient=patient, appointment=appointment, total_amount=doctor.consultation_fee,
        bill_date=appointment_date, payment_status="pending", created_by=receptionist.staff,
    )
    return appointment
