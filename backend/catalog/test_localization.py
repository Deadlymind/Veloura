from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import Category, Product, ProductImage, ProductVariant

class LocalizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Skincare', slug='skin', translations={'fr': {'name': 'Soins du visage'}})
        self.product = Product.objects.create(name='Serum', slug='serum', category=self.category, price='38.00', stock=4, description='English fallback', attribute='Serum', translations={'fr': {'name': 'Sérum Rosée', 'attribute': 'Sérum'}})
        ProductImage.objects.create(product=self.product, image_url='/images/serum.png', alt='Serum bottle', translations={'fr': {'alt': 'Flacon de sérum'}})

    def test_french_catalog_and_english_fallback_preserve_identity_price(self):
        english = self.client.get('/api/products/serum/', HTTP_ACCEPT_LANGUAGE='en').json()
        french = self.client.get('/api/products/serum/', HTTP_ACCEPT_LANGUAGE='fr').json()
        self.assertEqual(french['name'], 'Sérum Rosée')
        self.assertEqual(french['category']['name'], 'Soins du visage')
        self.assertEqual(french['images'][0]['alt'], 'Flacon de sérum')
        self.assertEqual(french['description'], 'English fallback')
        for key in ['id', 'slug', 'price', 'stock']:
            self.assertEqual(english[key], french[key])
        self.assertEqual(english['name'], 'Serum')

    def test_french_search_filter_and_pagination(self):
        result = self.client.get('/api/products/?search=Rosée&attribute=Serum&ordering=price&page=1', HTTP_ACCEPT_LANGUAGE='fr').json()
        self.assertEqual(result['count'], 1)
        self.assertEqual(result['results'][0]['name'], 'Sérum Rosée')
        config = self.client.get('/api/config/', HTTP_ACCEPT_LANGUAGE='fr').json()
        self.assertEqual(config['locale'], 'fr-FR')
        self.assertEqual(config['attributes'][0]['attribute'], 'Serum')
        self.assertEqual(config['attributes'][0]['label'], 'Sérum')

    def test_french_bag_variant_and_stock_message(self):
        variant = ProductVariant.objects.create(product=self.product, name='Petal', sku='FR-1', stock=2, translations={'fr': {'name': 'Pétale'}})
        result = self.client.post('/api/bag/validate/', {'items': [{'product_id': self.product.id, 'variant_id': variant.id, 'quantity': 3}]}, format='json', HTTP_ACCEPT_LANGUAGE='fr').json()
        self.assertEqual(result['items'][0]['name'], 'Sérum Rosée')
        self.assertEqual(result['items'][0]['variant_name'], 'Pétale')
        self.assertEqual(result['items'][0]['quantity'], 2)
        self.assertIn('quantité ajustée', result['items'][0]['message'])
        self.assertEqual(result['subtotal'], '76.00')

    def test_staff_translation_validation_and_canonical_fields(self):
        user = get_user_model().objects.create_superuser('translator', '', 'Valid-long-test-pass')
        self.client.force_login(user)
        url = f'/api/staff/products/{self.product.id}/'
        data = self.client.get(url, HTTP_ACCEPT_LANGUAGE='fr').json()
        self.assertEqual(data['name'], 'Serum')
        self.assertEqual(data['translations']['fr']['name'], 'Sérum Rosée')
        for bad in [{'de': {'name': 'X'}}, {'fr': {'stock': 500}}, {'fr': {'name': ['invalid']}}, {'fr': {'name': 'a' * 251}}]:
            self.assertEqual(self.client.patch(url, {'translations': bad}, format='json').status_code, 400)
        response = self.client.patch(url, {'translations': {'fr': {'name': 'Sérum du matin'}}}, format='json')
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, 'Serum')
        self.assertEqual(self.product.stock, 4)

    def test_language_cookie_and_french_errors(self):
        self.client.cookies['django_language'] = 'fr'
        self.assertEqual(self.client.get('/api/products/serum/').json()['name'], 'Sérum Rosée')
        error = self.client.get('/api/products/?min_price=-1').json()
        self.assertIn('Saisissez', str(error))
        response = self.client.post('/api/staff/login/', {'username': 'missing', 'password': 'missing'}, format='json')
        self.assertIn('Impossible de se connecter', str(response.json()))

    def test_unpublished_translations_stay_private(self):
        self.product.is_active = False
        self.product.save()
        self.assertEqual(self.client.get('/api/products/serum/', HTTP_ACCEPT_LANGUAGE='fr').status_code, 404)
        self.assertEqual(self.client.get('/api/products/?search=Rosée', HTTP_ACCEPT_LANGUAGE='fr').json()['count'], 0)
