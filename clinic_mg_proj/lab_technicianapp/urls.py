from django.urls import path
from .views import assigned_orders, save_result

urlpatterns = [
    path("orders/", assigned_orders, name="lab-technician-orders"),
    path("items/<int:item_id>/result/", save_result, name="lab-technician-result"),
]
