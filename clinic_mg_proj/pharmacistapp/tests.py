from rest_framework.test import APITestCase
from rest_framework import status

from core.models import Medicine, Role, User


class PharmacistSecurityTests(APITestCase):
    def setUp(self):
        self.pharmacist_role = Role.objects.create(role_name="Pharmacist")
        self.admin_role = Role.objects.create(role_name="Administrator")
        self.pharmacist = User.objects.create_user(
            username="pharmacist", password="real-password", role=self.pharmacist_role
        )
        self.admin = User.objects.create_user(
            username="administrator", password="real-password", role=self.admin_role
        )
        self.medicine = Medicine.objects.create(
            medicine_name="Test Medicine", manufacturer="Clinic", unit_price="2.50",
            quantity=5, expiry_date="2030-01-01", is_active=True
        )

    def login_as(self, user):
        response = self.client.post("/pharmacist/login/", {
            "username": user.username, "password": "real-password"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def login_admin(self):
        response = self.client.post("/api/login/", {
            "username": self.admin.username, "password": "real-password"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "administrator")
        token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return response

    def test_pharmacist_login_returns_server_signed_jwt(self):
        response = self.login_as(self.pharmacist)
        self.assertEqual(response.data["role"], "Pharmacist")
        self.assertNotIn("password", response.data)
        self.assertEqual(self.client.get("/pharmacist/me/").data["user_id"], self.pharmacist.user_id)

    def test_invalid_fallback_password_is_rejected_without_changing_password(self):
        response = self.client.post("/pharmacist/login/", {
            "username": "pharmacist", "password": "Pharma 1234"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.pharmacist.refresh_from_db()
        self.assertTrue(self.pharmacist.check_password("real-password"))
        self.assertFalse(self.pharmacist.check_password("Pharma 1234"))

    def test_unauthenticated_requests_are_rejected(self):
        for url in ("/pharmacist/me/", "/pharmacist/medicines/", "/pharmacist/prescriptions/", "/pharmacist/prescription-medicines/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post("/pharmacist/medicines/", {}, format="json").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post("/pharmacist/prescription-medicines/1/dispense/", {}, format="json").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_pharmacist_cannot_access_pharmacist_endpoints(self):
        self.login_admin()
        for url in ("/pharmacist/me/", "/pharmacist/medicines/", "/pharmacist/prescriptions/", "/pharmacist/prescription-medicines/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post("/pharmacist/medicines/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post("/pharmacist/prescription-medicines/1/dispense/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)

    def test_pharmacist_can_access_pharmacist_data(self):
        self.login_as(self.pharmacist)
        self.assertEqual(self.client.get("/pharmacist/medicines/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/pharmacist/prescriptions/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/pharmacist/prescription-medicines/").status_code, status.HTTP_200_OK)

    def test_pharmacist_cannot_mutate_prescription_medicine_except_dispense_action(self):
        self.login_as(self.pharmacist)
        response = self.client.post("/pharmacist/prescription-medicines/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_inactive_role_cannot_access_pharmacist_api(self):
        self.login_as(self.pharmacist)
        self.pharmacist_role.is_active = False
        self.pharmacist_role.save(update_fields=["is_active"])
        self.assertEqual(self.client.get("/pharmacist/medicines/").status_code, status.HTTP_403_FORBIDDEN)
