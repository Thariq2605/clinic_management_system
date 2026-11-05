from django.db import models


class PharmacyDispense(models.Model):
    dispense_id = models.AutoField(primary_key=True)
    prescription_medicine = models.OneToOneField(
        "core.PrescriptionMedicine",
        on_delete=models.PROTECT,
        related_name="pharmacy_dispense",
    )
    medicine = models.ForeignKey(
        "core.Medicine",
        on_delete=models.PROTECT,
        related_name="pharmacy_dispenses",
    )
    medicine_name = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    dispensed_by = models.ForeignKey(
        "core.Staff",
        on_delete=models.PROTECT,
        related_name="pharmacy_dispenses",
    )
    bill = models.ForeignKey(
        "core.Bill",
        on_delete=models.PROTECT,
        related_name="pharmacy_dispenses",
        blank=True,
        null=True,
    )
    dispensed_at = models.DateTimeField()

    class Meta:
        ordering = ["dispense_id"]

    @property
    def line_total(self):
        return self.unit_price * self.quantity
