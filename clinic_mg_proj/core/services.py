from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone


def appointment_payment_completed(appointment):
    """Return whether an appointment has one active, fully settled bill.

    A recorded payment is considered successful by the current system when the
    active payment records cover the bill total and both existing status fields
    reflect full payment. Partial payments never make an appointment eligible.
    """
    if not appointment or not appointment.is_active or appointment.status == "cancelled":
        return False
    if str(appointment.payment_status).strip().casefold() != "paid":
        return False

    bills = appointment.bill_set.filter(is_active=True)
    if bills.count() != 1:
        return False
    bill = bills.first()
    if str(bill.payment_status).strip().casefold() != "paid":
        return False

    paid = bill.payment_set.filter(is_active=True).aggregate(total=Sum("amount"))["total"]
    paid = paid or Decimal("0.00")
    return paid >= bill.total_amount


def appointment_queue_eligible(appointment):
    """Whether a paid appointment is in an active, current-day queue state."""
    return (
        bool(appointment)
        and appointment.appointment_date == timezone.localdate()
        and appointment.status in ("scheduled", "confirmed", "serving")
        and appointment_payment_completed(appointment)
    )
