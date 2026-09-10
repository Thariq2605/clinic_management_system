from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


# =========================================================
# USER MANAGER
# =========================================================

class UserManager(BaseUserManager):

    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("Username is required")

        user = self.model(
            username=username,
            **extra_fields
        )

        if password:
            user.set_password(password)

        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        user = self.create_user(
            username=username,
            password=password,
            **extra_fields
        )
        return user


# =========================================================
# ROLE
# =========================================================

class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    role_name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "role"

    def __str__(self):
        return self.role_name


# =========================================================
# USER
# =========================================================

class User(AbstractBaseUser):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=255)
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        db_column="role_id"
    )
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = "username"

    class Meta:
        db_table = "user"

    def __str__(self):
        return self.username


# =========================================================
# DEPARTMENT
# =========================================================

class Department(models.Model):
    department_id = models.AutoField(primary_key=True)
    department_name = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "department"

    def __str__(self):
        return self.department_name


# =========================================================
# STAFF
# =========================================================

class Staff(models.Model):
    staff_id = models.AutoField(primary_key=True)

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        db_column="user_id"
    )

    full_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10)
    dob = models.DateField()
    mobile_number = models.CharField(max_length=15)
    email = models.CharField(max_length=100)

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        db_column="department_id"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "staff"

    def __str__(self):
        return self.full_name


# =========================================================
# RECEPTIONIST
# =========================================================

class Receptionist(models.Model):
    receptionist_id = models.AutoField(primary_key=True)

    staff = models.OneToOneField(
        Staff,
        on_delete=models.CASCADE,
        db_column="staff_id"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "receptionist"

    def __str__(self):
        return self.staff.full_name


# =========================================================
# SPECIALIZATION
# =========================================================

class Specialization(models.Model):
    specialization_id = models.AutoField(primary_key=True)
    specialization_name = models.CharField(max_length=100)

    class Meta:
        db_table = "specialization"

    def __str__(self):
        return self.specialization_name


# =========================================================
# DOCTOR
# =========================================================

class Doctor(models.Model):
    doctor_id = models.AutoField(primary_key=True)

    staff = models.ForeignKey(
        Staff,
        on_delete=models.PROTECT,
        db_column="staff_id"
    )

    specialization = models.ForeignKey(
        Specialization,
        on_delete=models.PROTECT,
        db_column="specialization_id"
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        db_column="department_id"
    )

    consultation_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    qualification = models.CharField(max_length=100)
    experience_years = models.IntegerField()
    license_number = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "doctor"

    def __str__(self):
        return self.staff.full_name


# =========================================================
# PATIENT
# =========================================================

class Patient(models.Model):
    patient_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=100)
    dob = models.DateField()
    gender = models.CharField(max_length=10)
    mobile_number = models.CharField(max_length=15)
    email = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    blood_group = models.CharField(max_length=10)
    emergency_contact = models.CharField(max_length=15)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "patient"

    def __str__(self):
        return self.full_name


# =========================================================
# APPOINTMENT
# =========================================================

class Appointment(models.Model):

    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("confirmed", "Confirmed"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    appointment_id = models.AutoField(primary_key=True)

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        db_column="patient_id"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.PROTECT,
        db_column="doctor_id"
    )

    receptionist = models.ForeignKey(
        Receptionist,
        on_delete=models.PROTECT,
        db_column="receptionist_id"
    )

    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    token_number = models.CharField(max_length=10)
    reason = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES
    )
    created_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "appointment"

    def __str__(self):
        return f"{self.patient.full_name} - {self.appointment_date}"


# =========================================================
# CONSULTATION
# =========================================================

class Consultation(models.Model):
    consultation_id = models.AutoField(primary_key=True)

    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.PROTECT,
        db_column="appointment_id"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.PROTECT,
        db_column="doctor_id"
    )

    symptoms = models.CharField(max_length=255)
    diagnosis = models.CharField(max_length=255)
    notes = models.CharField(max_length=500)
    consultation_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "consultation"

    def __str__(self):
        return f"Consultation {self.consultation_id}"


# =========================================================
# PRESCRIPTION
# =========================================================

class Prescription(models.Model):
    prescription_id = models.AutoField(primary_key=True)

    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.PROTECT,
        db_column="consultation_id"
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        db_column="patient_id"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.PROTECT,
        db_column="doctor_id"
    )

    prescription_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "prescription"

    def __str__(self):
        return f"Prescription {self.prescription_id}"


# =========================================================
# MEDICINE
# =========================================================

class Medicine(models.Model):
    medicine_id = models.AutoField(primary_key=True)
    medicine_name = models.CharField(max_length=100)
    manufacturer = models.CharField(max_length=100)

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    quantity = models.IntegerField()
    expiry_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "medicine"

    def __str__(self):
        return self.medicine_name


# =========================================================
# PRESCRIPTION MEDICINE
# =========================================================

class PrescriptionMedicine(models.Model):
    item_id = models.AutoField(primary_key=True)

    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        db_column="prescription_id"
    )

    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.PROTECT,
        db_column="medicine_id"
    )

    dosage = models.CharField(max_length=50)
    frequency = models.CharField(max_length=50)
    duration = models.IntegerField()
    instructions = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "prescription_medicine"

    def __str__(self):
        return self.medicine.medicine_name


# =========================================================
# LAB TEST
# =========================================================

class LabTest(models.Model):
    test_id = models.AutoField(primary_key=True)
    test_name = models.CharField(max_length=100)
    test_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255)

    test_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    normal_range = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "lab_test"

    def __str__(self):
        return self.test_name


# =========================================================
# PRESCRIPTION LAB TEST
# =========================================================

class PrescriptionLabTest(models.Model):
    prescription_lab_test_id = models.AutoField(primary_key=True)

    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        db_column="prescription_id"
    )

    test = models.ForeignKey(
        LabTest,
        on_delete=models.PROTECT,
        db_column="test_id"
    )

    instructions = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "prescription_lab_test"

    def __str__(self):
        return self.test.test_name


# =========================================================
# LAB ORDER
# =========================================================

class LabOrder(models.Model):

    PRIORITY_CHOICES = [
        ("normal", "Normal"),
        ("urgent", "Urgent"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    order_id = models.AutoField(primary_key=True)

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        db_column="patient_id"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.PROTECT,
        db_column="doctor_id"
    )

    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.PROTECT,
        db_column="appointment_id"
    )

    order_date = models.DateField()

    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "lab_order"

    def __str__(self):
        return f"Lab Order {self.order_id}"


# =========================================================
# LAB TECHNICIAN
# =========================================================

class LabTechnician(models.Model):
    technician_id = models.AutoField(primary_key=True)

    staff = models.ForeignKey(
        Staff,
        on_delete=models.PROTECT,
        db_column="staff_id"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "lab_technician"

    def __str__(self):
        return self.staff.full_name


# =========================================================
# LAB ORDER ITEM
# =========================================================

class LabOrderItem(models.Model):

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    item_id = models.AutoField(primary_key=True)

    order = models.ForeignKey(
        LabOrder,
        on_delete=models.CASCADE,
        db_column="order_id"
    )

    test = models.ForeignKey(
        LabTest,
        on_delete=models.PROTECT,
        db_column="test_id"
    )

    technician = models.ForeignKey(
        LabTechnician,
        on_delete=models.PROTECT,
        db_column="technician_id"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "lab_order_item"

    def __str__(self):
        return f"{self.order} - {self.test.test_name}"


# =========================================================
# MEDICAL RECORD
# =========================================================

class MedicalRecord(models.Model):
    record_id = models.AutoField(primary_key=True)

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        db_column="patient_id"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.PROTECT,
        db_column="doctor_id"
    )

    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.PROTECT,
        db_column="consultation_id"
    )

    diagnosis = models.CharField(max_length=255)
    medical_notes = models.CharField(max_length=500)
    created_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "medical_record"

    def __str__(self):
        return f"Medical Record {self.record_id}"


# =========================================================
# BILL
# =========================================================

class Bill(models.Model):

    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("partial", "Partial"),
        ("paid", "Paid"),
    ]

    bill_id = models.AutoField(primary_key=True)

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        db_column="patient_id"
    )

    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.PROTECT,
        db_column="appointment_id"
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    bill_date = models.DateField()

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES
    )

    created_by = models.ForeignKey(
        Staff,
        on_delete=models.PROTECT,
        db_column="created_by"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "bill"

    def __str__(self):
        return f"Bill {self.bill_id}"


# =========================================================
# PAYMENT
# =========================================================

class Payment(models.Model):

    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("card", "Card"),
        ("upi", "UPI"),
        ("online", "Online"),
    ]

    payment_id = models.AutoField(primary_key=True)

    bill = models.ForeignKey(
        Bill,
        on_delete=models.CASCADE,
        db_column="bill_id"
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES
    )

    payment_date = models.DateTimeField()
    transaction_reference = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "payment"

    def __str__(self):
        return f"Payment {self.payment_id}"