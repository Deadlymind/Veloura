from decimal import Decimal
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Category, Product, ProductVariant

@override_settings(REST_FRAMEWORK={'DEFAULT_THROTTLE_CLASSES': []})
class CatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Skincare', slug='skincare')
        self.simple = Product.objects.create(category=self.category, name='Daily Serum', slug='daily-serum', description='Morning ritual', price='30.00', stock=4, attribute='Serum', featured=True)
        self.variable = Product.objects.create(category=self.category, name='Cream', slug='cream', price='20.00', stock=999)
        self.small = ProductVariant.objects.create(product=self.variable, name='30 ml', sku='CREAM-S', stock=2, price='25.00')
        self.large = ProductVariant.objects.create(product=self.variable, name='50 ml', sku='CREAM-L', stock=0, price='40.00')
        self.hidden = Product.objects.create(category=self.category, name='Hidden', slug='hidden', price='1.00', is_active=False)

    def validate(self, items):
        return self.client.post('/api/bag/validate/', {'items': items}, format='json')

    def item(self, product=None, variant=None, quantity=1):
        return {'product_id': (product or self.simple).id, 'variant_id': variant.id if variant else None, 'quantity': quantity}

    def test_catalog_search_and_pagination(self):
        response = self.client.get('/api/products/?search=serum&page_size=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['slug'], 'daily-serum')
        response = self.client.get('/api/products/?page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertIsNotNone(response.data['next'])

    def test_price_sort_matches_displayed_variant_price(self):
        response = self.client.get('/api/products/?ordering=price')
        self.assertEqual([p['slug'] for p in response.data['results']], ['cream', 'daily-serum'])
        self.assertEqual(Decimal(response.data['results'][0]['display_price']), Decimal('25'))
        response = self.client.get('/api/products/?min_price=26&max_price=32')
        self.assertEqual([p['slug'] for p in response.data['results']], ['daily-serum'])

    def test_variant_stock_takes_precedence_over_base_stock(self):
        self.small.stock = 0
        self.small.save()
        response = self.client.get('/api/products/?availability=in-stock')
        self.assertEqual([p['slug'] for p in response.data['results']], ['daily-serum'])
        response = self.client.get('/api/products/?availability=out-of-stock')
        self.assertEqual([p['slug'] for p in response.data['results']], ['cream'])

    def test_invalid_filters_return_400(self):
        for query in ['min_price=NaN', 'max_price=Infinity', 'min_price=-2', 'min_price=80&max_price=10', 'ordering=stock', 'availability=maybe', 'featured=yes']:
            with self.subTest(query=query):
                self.assertEqual(self.client.get('/api/products/?' + query).status_code, 400)

    def test_category_attribute_and_featured_filters(self):
        response = self.client.get('/api/products/?category=skincare&attribute=Serum&featured=true')
        self.assertEqual(response.data['count'], 1)

    def test_hidden_product_unavailable_everywhere(self):
        self.assertEqual(self.client.get('/api/products/hidden/').status_code, 404)
        line = self.validate([self.item(self.hidden)]).data['items'][0]
        self.assertEqual(line['quantity'], 0)

    def test_bag_uses_live_price_and_stock(self):
        self.simple.price = Decimal('35.50')
        self.simple.save()
        response = self.validate([self.item(quantity=6)])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['items'][0]['quantity'], 4)
        self.assertEqual(response.data['items'][0]['price'], '35.50')
        self.assertEqual(response.data['subtotal'], '142.00')
        self.assertTrue(response.data['items'][0]['message'])

    def test_variant_price_and_stock(self):
        response = self.validate([self.item(self.variable, self.small, 3)])
        self.assertEqual(response.data['subtotal'], '50.00')
        self.assertEqual(response.data['items'][0]['quantity'], 2)

    def test_out_of_stock_and_missing_variant_cannot_be_added(self):
        for item in [self.item(self.variable, self.large), self.item(self.variable), self.item(self.simple, self.small)]:
            with self.subTest(item=item):
                response = self.validate([item])
                self.assertEqual(response.data['items'][0]['quantity'], 0)
                self.assertEqual(response.data['subtotal'], '0.00')

    def test_invalid_quantity_and_duplicate_lines(self):
        for quantity in [0, -1, 100, 'bad', 1.5]:
            self.assertEqual(self.validate([self.item(quantity=quantity)]).status_code, 400)
        self.assertEqual(self.validate([self.item(), self.item()]).status_code, 400)
        self.assertEqual(self.validate([self.item()] * 101).status_code, 400)

    def test_deleted_product_gives_helpful_bag_message(self):
        item = self.item()
        self.simple.delete()
        response = self.validate([item])
        self.assertEqual(response.data['items'][0]['quantity'], 0)
        self.assertIn('no longer available', response.data['items'][0]['message'])

    @override_settings(STORE_CURRENCY='NGN')
    def test_currency_configuration(self):
        self.assertEqual(self.client.get('/api/config/').data['currency'], 'NGN')
        self.assertEqual(self.validate([]).data['currency'], 'NGN')

    def test_catalog_is_read_only(self):
        self.assertEqual(self.client.post('/api/products/', {}).status_code, 405)

    def test_seed_is_idempotent(self):
        from django.core.management import call_command
        from io import StringIO
        call_command('seed_demo', stdout=StringIO())
        count = Product.objects.count()
        call_command('seed_demo', stdout=StringIO())
        self.assertEqual(Product.objects.count(), count)
