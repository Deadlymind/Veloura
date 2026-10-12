import tempfile
from io import BytesIO
from PIL import Image
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import Product, ProductVariant, ProductImage, Category, StoreSettings, AuditLog
from .staff_views import ensure_roles

class StaffTests(TestCase):
    def setUp(self):
        ensure_roles()
        self.admin = get_user_model().objects.create_user('manager', password='A-test-secret-6482', is_staff=True)
        self.admin.groups.add(Group.objects.get(name='Veloura Administrators'))
        self.editor = get_user_model().objects.create_user('editor', password='A-test-secret-6482', is_staff=True)
        self.editor.groups.add(Group.objects.get(name='Veloura Catalog Editors'))
        self.client = APIClient()
        self.client.force_login(self.admin)
        self.category = Category.objects.create(name='Skin', slug='skin')
        self.product = Product.objects.create(name='Test Serum', slug='test-serum', category=self.category, description='Sample', price='30.00', stock=4)

    def test_all_staff_endpoints_deny_anonymous(self):
        self.client.logout()
        for path in ['session', 'overview', 'products', 'categories', 'images', 'variants', 'inventory', 'settings', 'activity', 'users']:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(f'/api/staff/{path}/').status_code, 403)

    def test_staff_without_permissions_is_denied(self):
        user = get_user_model().objects.create_user('unassigned', is_staff=True)
        self.client.force_login(user)
        self.assertEqual(self.client.get('/api/staff/overview/').status_code, 403)

    def test_csrf_login_required_then_valid_session(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/staff/login/', {'username': 'manager', 'password': 'A-test-secret-6482'}).status_code, 403)
        token = client.get('/api/staff/csrf/').data['csrfToken']
        response = client.post('/api/staff/login/', {'username': 'manager', 'password': 'A-test-secret-6482'}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get('/api/staff/session/').data['user']['role'], 'Administrator')
        self.assertEqual(client.patch(f'/api/staff/products/{self.product.id}/', {'price': '45.00'}, format='json').status_code, 403)
        response = client.patch(f'/api/staff/products/{self.product.id}/', {'price': '45.00'}, format='json', HTTP_X_CSRFTOKEN=response.data['csrfToken'])
        self.assertEqual(response.status_code, 200)

    def test_editor_can_edit_catalog_but_not_settings_or_staff(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.client.patch(f'/api/staff/products/{self.product.id}/', {'price': '35.00'}, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/staff/settings/').status_code, 200)
        self.assertEqual(self.client.patch('/api/staff/settings/', {'contact_email': 'team@example.com'}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/staff/users/').status_code, 403)
        self.assertEqual(self.client.post('/api/staff/users/', {}).status_code, 403)

    def test_publish_unpublish_affects_storefront(self):
        response = self.client.patch(f'/api/staff/products/{self.product.id}/', {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/products/test-serum/').status_code, 404)
        self.client.patch(f'/api/staff/products/{self.product.id}/', {'is_active': True}, format='json')
        self.assertEqual(self.client.get('/api/products/test-serum/').status_code, 200)

    def test_invalid_prices_slugs_stock_and_variants(self):
        for data in [{'price': '-1.00'}, {'stock': -2}, {'slug': 'bad slug'}]:
            self.assertEqual(self.client.patch(f'/api/staff/products/{self.product.id}/', data, format='json').status_code, 400)
        data = {'product': self.product.id, 'name': 'Rose', 'sku': 'ROSE', 'stock': 3, 'color': '#zzzzzz'}
        self.assertEqual(self.client.post('/api/staff/variants/', data, format='json').status_code, 400)
        data['color'] = '#C18B7C'
        self.assertEqual(self.client.post('/api/staff/variants/', data, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/staff/variants/', data, format='json').status_code, 400)

    def test_price_and_stock_audit_has_actor_and_values(self):
        self.client.patch(f'/api/staff/products/{self.product.id}/', {'price': '38.50'}, format='json')
        audit = AuditLog.objects.filter(action='updated').first()
        self.assertEqual(audit.actor_name, 'manager')
        self.assertEqual(audit.changes['price'], {'before': '30.00', 'after': '38.50'})
        self.assertEqual(self.client.delete(f'/api/staff/activity/{audit.id}/').status_code, 404)

    def test_inventory_conflicts_and_variant_precedence(self):
        data = {'product_id': self.product.id, 'stock': 7, 'expected_stock': 4}
        self.assertEqual(self.client.patch('/api/staff/inventory/', data, format='json').status_code, 200)
        self.assertEqual(self.client.patch('/api/staff/inventory/', data, format='json').status_code, 409)
        v = ProductVariant.objects.create(product=self.product, name='Small', sku='SMALL', stock=2)
        data['expected_stock'] = 7
        self.assertEqual(self.client.patch('/api/staff/inventory/', data, format='json').status_code, 400)
        data.update(variant_id=v.id, expected_stock=2)
        self.assertEqual(self.client.patch('/api/staff/inventory/', data, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/staff/inventory/').data['count'], 1)

    def test_category_with_products_cannot_be_deleted(self):
        self.assertEqual(self.client.delete(f'/api/staff/categories/{self.category.id}/').status_code, 400)

    def test_image_upload_reorder_alt_and_invalid_files(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(MEDIA_ROOT=folder):
            out = BytesIO(); Image.new('RGB', (20, 20), '#C18B7C').save(out, format='PNG')
            file = SimpleUploadedFile('test.png', out.getvalue(), content_type='image/png')
            response = self.client.post('/api/staff/images/', {'product': self.product.id, 'image': file, 'alt': 'Rose serum bottle'})
            self.assertEqual(response.status_code, 201, response.data)
            image_id = response.data['id']
            self.assertTrue(response.data['url'].startswith('/media/'))
            image2 = ProductImage.objects.create(product=self.product, image_url='/images/cream.png', alt='Cream')
            self.assertEqual(self.client.post(f'/api/staff/products/{self.product.id}/reorder_images/', {'ids': [image2.id, image_id]}, format='json').status_code, 200)
            self.assertEqual(self.product.images.first().id, image2.id)
            self.assertEqual(self.client.patch(f'/api/staff/images/{image_id}/', {'alt': ''}, format='json').status_code, 400)
            invalid = SimpleUploadedFile('bad.png', b'not an image', content_type='image/png')
            self.assertEqual(self.client.post('/api/staff/images/', {'product': self.product.id, 'image': invalid, 'alt': 'Bad'}).status_code, 400)

    def test_settings_are_public_and_currency_requires_confirmation(self):
        self.assertEqual(self.client.patch('/api/staff/settings/', {'currency': 'NGN'}, format='json').status_code, 400)
        data = {'currency': 'NGN', 'locale': 'en-NG', 'confirm_currency_change': True, 'contact_email': 'hello@example.com'}
        self.assertEqual(self.client.patch('/api/staff/settings/', data, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/config/').data['currency'], 'NGN')
        self.assertEqual(self.client.post('/api/bag/validate/', {'items': []}, format='json').data['currency'], 'NGN')
        self.assertEqual(self.client.patch('/api/staff/settings/', {'logo_url': 'javascript:alert(1)'}, format='json').status_code, 400)

    def test_create_staff_and_deactivate(self):
        data = {'username': 'neweditor', 'role': 'Catalog Editor', 'password': 'Long-Random-Pass-9813', 'is_active': True}
        response = self.client.post('/api/staff/users/', data, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('password', response.data)
        data['is_active'] = False
        self.assertEqual(self.client.patch(f"/api/staff/users/{response.data['id']}/", data, format='json').status_code, 200)
        self.assertFalse(get_user_model().objects.get(username='neweditor').is_active)

    def test_cannot_remove_own_access(self):
        data = {'username': 'manager', 'role': 'Catalog Editor', 'is_active': False}
        self.assertEqual(self.client.patch(f'/api/staff/users/{self.admin.id}/', data, format='json').status_code, 400)

    def test_overview_uses_variant_counts_and_incomplete_content(self):
        ProductVariant.objects.create(product=self.product, name='Small', sku='SMALL', stock=0)
        ProductVariant.objects.create(product=self.product, name='Large', sku='LARGE', stock=2)
        data = self.client.get('/api/staff/overview/').data
        self.assertEqual(data['total_products'], 1)
        self.assertEqual(data['out_of_stock'], 1)
        self.assertEqual(data['low_stock'], 1)
        self.assertEqual(data['incomplete_count'], 1)
