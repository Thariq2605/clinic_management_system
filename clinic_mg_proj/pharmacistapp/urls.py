from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, PrescriptionMedicineViewSet, PharmacistLoginView, PrescriptionViewSet

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet)
router.register(r'prescription-medicines', PrescriptionMedicineViewSet)
router.register(r'prescriptions', PrescriptionViewSet)

urlpatterns = [
    path('login/', PharmacistLoginView.as_view(), name='pharmacist-login'),
] + router.urls