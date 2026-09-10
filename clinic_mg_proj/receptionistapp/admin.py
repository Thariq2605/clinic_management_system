from django.contrib import admin

from .models import (
    Role,
    User,
    Department,
    Staff,
    Receptionist,
    Specialization,
    Doctor,
    Patient,
    Appointment,
    Consultation,
    Prescription,
    PrescriptionMedicine,
    Medicine,
    LabTest,
    PrescriptionLabTest,
    LabOrder,
    LabOrderItem,
    LabTechnician,
    MedicalRecord,
    Bill,
    Payment,
)


admin.site.register(Role)
admin.site.register(User)
admin.site.register(Department)
admin.site.register(Staff)
admin.site.register(Receptionist)
admin.site.register(Specialization)
admin.site.register(Doctor)
admin.site.register(Patient)
admin.site.register(Appointment)
admin.site.register(Consultation)
admin.site.register(Prescription)
admin.site.register(PrescriptionMedicine)
admin.site.register(Medicine)
admin.site.register(LabTest)
admin.site.register(PrescriptionLabTest)
admin.site.register(LabOrder)
admin.site.register(LabOrderItem)
admin.site.register(LabTechnician)
admin.site.register(MedicalRecord)
admin.site.register(Bill)
admin.site.register(Payment)