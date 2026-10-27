from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.models import LabOrderItem, LabTechnician
from .permissions import IsLabTechnician


def _item_data(item):
    return {
        "item_id": item.item_id,
        "order_id": item.order_id,
        "patient_id": item.order.patient_id,
        "patient_name": item.order.patient.full_name,
        "appointment_id": item.order.appointment_id,
        "doctor_id": item.order.doctor_id,
        "test_id": item.test_id,
        "test_name": item.test.test_name,
        "status": item.status,
        "result": item.result,
    }


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsLabTechnician])
def assigned_orders(request):
    technician = get_object_or_404(
        LabTechnician, staff__user=request.user, staff__is_active=True, is_active=True
    )
    items = LabOrderItem.objects.filter(
        technician=technician, is_active=True, order__is_active=True
    ).select_related("order__patient", "order__appointment", "order__doctor", "test")
    return Response([_item_data(item) for item in items.order_by("order__order_date", "item_id")])


@api_view(["PUT", "PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsLabTechnician])
def save_result(request, item_id):
    technician = get_object_or_404(
        LabTechnician, staff__user=request.user, staff__is_active=True, is_active=True
    )
    text = request.data.get("result")
    if not isinstance(text, str) or not text.strip():
        return Response({"result": "A non-empty text result is required."}, status=400)
    if len(text) > 10000:
        return Response({"result": "Result must be 10000 characters or fewer."}, status=400)

    with transaction.atomic():
        item = get_object_or_404(
            LabOrderItem.objects.select_for_update().select_related("order"),
            item_id=item_id, technician=technician, is_active=True, order__is_active=True,
        )
        if item.status == "cancelled" or item.order.status == "cancelled":
            return Response({"error": "Cancelled laboratory work cannot be updated."}, status=409)
        item.result = text.strip()
        item.status = "completed"
        item.save(update_fields=["result", "status"])
        if not item.order.laborderitem_set.filter(is_active=True).exclude(status__in=["completed", "cancelled"]).exists():
            item.order.status = "completed"
            item.order.save(update_fields=["status"])
    return Response(_item_data(item), status=status.HTTP_200_OK)
