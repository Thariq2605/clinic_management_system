from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, PrescriptionMedicineViewSet, PharmacistLoginView, PrescriptionViewSet, BillViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet)
router.register(r'prescription-medicines', PrescriptionMedicineViewSet)
router.register(r'prescriptions', PrescriptionViewSet)
router.register(r'bills', BillViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('login/', PharmacistLoginView.as_view(), name='pharmacist-login'),
] + router.urls