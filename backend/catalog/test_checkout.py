import uuid
from decimal import Decimal
from django.test import TestCase
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from .models import Category, Product, ProductVariant, Order
from .checkout import change_order_status, CheckoutConflict
from .staff_views import ensure_roles

class CheckoutTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name='Skin', slug='skin')
        self.product = Product.objects.create(name='Serum', slug='serum', category=self.category, price='25.50', stock=3)
        self.payload = {'idempotency_key': str(uuid.uuid4()), 'currency': 'USD', 'full_name': 'Test Customer', 'email': 'customer@example.com', 'phone': '+2348001234567', 'address_line1': '12 Example Street', 'city': 'Lagos', 'country': 'Nigeria', 'acknowledged': True, 'items': [{'product_id': self.product.id, 'variant_id': None, 'quantity': 2, 'expected_price': '25.50'}]}

    def place(self, payload=None):
        return self.client.post('/api/checkout/', payload or self.payload, format='json')

    def test_creates_unpaid_snapshot_without_reserving_stock(self):
        response = self.place()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['payment_status'], 'unpaid')
        order = Order.objects.get()
        self.assertEqual(order.subtotal, Decimal('51.00'))
        self.assertEqual(order.status, 'pending')
        self.assertEqual(order.items.get().product_name, 'Serum')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)
        self.assertNotIn('email', response.data)
        self.assertNotIn('full_name', response.data)

    def test_exact_retry_is_idempotentent_and_changed_payload_is_rejected(self):
        first = self.place()
        second = self.place()
        self.assertEqual(first.data['reference'], second.data['reference'])
        self.assertEqual(Order.objects.count(), 1)
        self.payload['full_name'] = 'Someone else'
        self.assertEqual(self.place().status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    def test_changed_price_currency_and_stock_reject_entire_request(self):
        self.payload['items'][0]['expected_price'] = '0.01'
        self.assertEqual(self.place().status_code, 409)
        self.payload['items'][0]['expected_price'] = '25.50'
        self.payload['currency'] = 'EUR'
        self.assertEqual(self.place().status_code, 409)
        self.payload['currency'] = 'USD'
        self.payload['items'][0]['quantity'] = 4
        self.assertEqual(self.place().status_code, 409)
        self.assertFalse(Order.objects.exists())

    def test_unpublished_and_missing_variant_are_rejected(self):
        variant = ProductVariant.objects.create(product=self.product, name='Petal', sku='V1', stock=2)
        self.assertEqual(self.place().status_code, 409)
        self.payload['items'][0]['variant_id'] = variant.id
        self.product.is_active = False
        self.product.save()
        self.assertEqual(self.place().status_code, 409)
        self.assertFalse(Order.objects.exists())

    def test_contact_validation_empty_items_duplicates_and_acknowledgement(self):
        for changes in [{'email': 'invalid'}, {'phone': '------'}, {'acknowledged': False}, {'items': []}, {'items': self.payload['items'] * 2}, {'notes': 'x' * 2001}, {'full_name': ''}]:
            self.assertEqual(self.place({**self.payload, **changes}).status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_confirmation_and_cancellation_change_stock_once(self):
        self.place()
        order = Order.objects.get()
        change_order_status(order.id, 'confirmed')
        change_order_status(order.id, 'confirmed')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)
        change_order_status(order.id, 'cancelled')
        change_order_status(order.id, 'cancelled')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)
        with self.assertRaises(CheckoutConflict):
            change_order_status(order.id, 'confirmed')

    def test_pending_cancel_does_not_add_stock(self):
        self.place()
        change_order_status(Order.objects.get().id, 'cancelled')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_competing_orders_cannot_oversell(self):
        self.place()
        first = Order.objects.get()
        self.payload['idempotency_key'] = str(uuid.uuid4())
        self.place()
        second = Order.objects.exclude(pk=first.pk).get()
        change_order_status(first.id, 'confirmed')
        with self.assertRaises(CheckoutConflict):
            change_order_status(second.id, 'confirmed')
        second.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(second.status, 'pending')
        self.assertEqual(self.product.stock, 1)

    def test_confirmation_rolls_back_all_lines(self):
        second = Product.objects.create(name='Cream', slug='cream', category=self.category, price='10.00', stock=1)
        self.payload['items'].append({'product_id': second.id, 'variant_id': None, 'quantity': 1, 'expected_price': '10.00'})
        self.place()
        second.stock = 0
        second.save()
        with self.assertRaises(CheckoutConflict):
            change_order_status(Order.objects.get().id, 'confirmed')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_variant_stock_and_snapshot_survive_catalog_edits(self):
        variant = ProductVariant.objects.create(product=self.product, name='Petal', sku='V1', price='30.00', stock=2)
        self.payload['items'][0].update(variant_id=variant.id, expected_price='30.00')
        self.place()
        order = Order.objects.get()
        self.assertEqual(order.items.get().sku, 'V1')
        change_order_status(order.id, 'confirmed')
        variant.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(variant.stock, 0)
        self.assertEqual(self.product.stock, 3)
        self.product.delete()
        order.refresh_from_db()
        self.assertEqual(order.items.get().product_name, 'Serum')
        self.assertEqual(order.subtotal, Decimal('60.00'))

    def test_csrf_required_and_valid_token_works(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/checkout/', self.payload, format='json').status_code, 403)
        token = client.get('/api/checkout/').data['csrfToken']
        self.assertEqual(client.post('/api/checkout/', self.payload, format='json', HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_admin_only_order_access_and_safe_status_mutation(self):
        self.place()
        order = Order.objects.get()
        self.assertEqual(self.client.get('/api/staff/orders/').status_code, 403)
        ensure_roles()
        editor = get_user_model().objects.create_user('editor', is_staff=True)
        editor.groups.add(Group.objects.get(name='Veloura Catalog Editors'))
        self.client.force_login(editor)
        self.assertEqual(self.client.get('/api/staff/orders/').status_code, 403)
        self.assertFalse(editor.has_perm('catalog.view_order'))
        admin = get_user_model().objects.create_superuser('owner', '', 'Valid-test-pass-long')
        self.client.force_login(admin)
        detail = self.client.get(f'/api/staff/orders/{order.id}/').data
        self.assertEqual(detail['email'], 'customer@example.com')
        self.assertNotIn('request_hash', detail)
        self.assertNotIn('idempotency_key', detail)
        self.assertEqual(self.client.patch(f'/api/staff/orders/{order.id}/', {'subtotal': '0.00'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/staff/orders/{order.id}/', {'status': 'confirmed'}, format='json').status_code, 200)

    def test_french_receipt_uses_localized_names_and_error(self):
        self.product.translations = {'fr': {'name': 'Sérum'}}
        self.product.save()
        self.client.cookies['django_language'] = 'fr'
        self.assertEqual(self.place().status_code, 201)
        self.assertEqual(Order.objects.get().items.get().product_name, 'Sérum')
        self.assertEqual(Order.objects.get().language, 'fr')
        self.payload['idempotency_key'] = str(uuid.uuid4())
        self.payload['currency'] = 'EUR'
        self.assertIn('Votre panier', str(self.place().data))
