from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, PrescriptionMedicineViewSet, PharmacistLoginView, PharmacistMeView, PrescriptionViewSet

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet)
router.register(r'prescription-medicines', PrescriptionMedicineViewSet)
router.register(r'prescriptions', PrescriptionViewSet)

urlpatterns = [
    path('login/', PharmacistLoginView.as_view(), name='pharmacist-login'),
    path('me/', PharmacistMeView.as_view(), name='pharmacist-me'),
] + router.urls
