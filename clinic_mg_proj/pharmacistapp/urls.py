from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, PrescriptionMedicineViewSet, PharmacistLoginView

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet)
router.register(r'prescription-medicines', PrescriptionMedicineViewSet)

urlpatterns = [
    path('login/', PharmacistLoginView.as_view(), name='pharmacist-login'),
] + router.urls