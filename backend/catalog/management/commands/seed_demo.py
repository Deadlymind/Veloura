from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from catalog.models import Category, Product, ProductImage, ProductVariant

PHOTOS = {
    'serum': 'serum',
    'cream': 'cream',
    'makeup': 'makeup',
    'lipstick': 'lipstick',
    'body': 'body',
    'hair': 'hair',
    'oil': 'body',
}
def photo(key):
    return '/images/' + PHOTOS[key] + '.png'

class Command(BaseCommand):
    help = 'Create a labeled demo catalog. Idempotent; leaves non-demo products untouched.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for i, (name, slug, description, pic) in enumerate([
            ('Skincare', 'skincare', 'A little care. A daily ritual. Discover textures and finishing touches for your skincare shelf.', 'serum'),
            ('Makeup', 'makeup', 'Color that feels like you. Explore considered shades for everyday expression.', 'makeup'),
            ('Haircare', 'haircare', 'Make room for your hair ritual, from the first wash to the final finishing touch.', 'hair'),
            ('Body Care', 'body-care', 'Everyday moments, beautifully considered. Explore your next body care ritual.', 'body'),
        ]):
            categories[slug], _ = Category.objects.get_or_create(slug=slug, defaults={'name': name, 'description': description, 'image_url': photo(pic), 'position': i})
            if categories[slug].image_url.startswith('https://images.unsplash.com/'):
                categories[slug].image_url = photo(pic)
                categories[slug].save(update_fields=['image_url'])
        rows = [
            ('Dew Drop Serum', 'dew-drop-serum', 'skincare', 'A moment of everyday luminosity', '38.00', 'Serum', 'serum', True, False, 24),
            ('Rose Veil Lip Color', 'rose-veil-lip-color', 'makeup', 'Your signature shade, softly spoken', '24.00', 'Lip color', 'lipstick', True, False, 0),
            ('The Daily Cream', 'the-daily-cream', 'skincare', 'A soft touch for your daily ritual', '42.00', 'Moisturizer', 'cream', True, True, 16),
            ('Botanical Body Oil', 'botanical-body-oil', 'body-care', 'A beautifully unhurried finishing touch', '36.00', 'Body oil', 'body', True, False, 12),
            ('Silk Ritual Hair Oil', 'silk-ritual-hair-oil', 'haircare', 'The final touch to your hair ritual', '32.00', 'Hair oil', 'hair', False, True, 18),
            ('Soft Bloom Blush', 'soft-bloom-blush', 'makeup', 'A little color. A little confidence.', '28.00', 'Blush', 'makeup', False, True, 15),
            ('Evening Cleansing Oil', 'evening-cleansing-oil', 'skincare', 'Let the day gently fall away', '34.00', 'Cleanser', 'oil', False, True, 20),
            ('The Body Soufflé', 'the-body-souffle', 'body-care', 'Make everyday feel a little special', '40.00', 'Body cream', 'cream', False, True, 0),
            ('Morning Mist', 'morning-mist', 'skincare', 'A pause in your morning routine', '26.00', 'Mist', 'serum', False, False, 19),
            ('Everyday Hair Wash', 'everyday-hair-wash', 'haircare', 'A fresh start for your ritual', '30.00', 'Shampoo', 'hair', False, False, 14),
            ('Nude Notes Lip Color', 'nude-notes-lip-color', 'makeup', 'Understated color, all your own', '24.00', 'Lip color', 'lipstick', False, True, 13),
            ('Velvet Body Wash', 'velvet-body-wash', 'body-care', 'An invitation to slow down', '29.00', 'Body wash', 'body', False, False, 22),
        ]
        for i, (name, slug, category, subtitle, price, attribute, pic, featured, new, stock) in enumerate(rows):
            existing = Product.objects.filter(slug=slug).first()
            if existing and not existing.is_demo:
                continue
            product, _ = Product.objects.update_or_create(slug=slug, defaults={'category': categories[category], 'name': name, 'subtitle': subtitle, 'description': f'{subtitle}. {name} is part of our thoughtfully imagined Veloura collection, created to make space for beauty in the everyday. Explore this sample product as you find your own ritual.', 'price': price, 'attribute': attribute, 'featured': featured, 'is_new': new, 'stock': stock, 'is_demo': True, 'ingredients': 'Demo product: a verified ingredient list has not been supplied. Replace this text with the complete manufacturer ingredient list before publishing.', 'usage': 'Demo product: usage instructions will be provided with the final product. Follow the instructions on your actual product packaging.', 'details': 'Illustrative catalog item. Product names, generated packaging imagery, prices and stock are for demonstration only. Concept photos are shared across sample products; final packaging may differ.'})
            ProductImage.objects.update_or_create(product=product, position=0, defaults={'image_url': photo(pic), 'alt': f'Illustrative {attribute.lower()} photography for {name}'})
            ProductImage.objects.update_or_create(product=product, position=1, defaults={'image_url': '/images/veloura-hero.png', 'alt': 'Veloura concept collection on warm stone with rose petals'})
            if slug == 'rose-veil-lip-color':
                for j, (shade, color, count) in enumerate([('Rosewood', '#985C54', 12), ('Petal', '#C78D82', 8), ('Terracotta', '#A95E40', 0)]):
                    ProductVariant.objects.update_or_create(sku=f'DEMO-LIP-{j}', defaults={'product': product, 'name': shade, 'shade': shade, 'color': color, 'stock': count, 'position': j})
            if slug == 'the-daily-cream':
                for j, (size, cost, count) in enumerate([('30 ml', '42.00', 16), ('50 ml', '58.00', 7), ('100 ml', '89.00', 0)]):
                    ProductVariant.objects.update_or_create(sku=f'DEMO-CREAM-{j}', defaults={'product': product, 'name': size, 'size': size, 'price': cost, 'stock': count, 'position': j})
        call_command('seed_french', stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS('Demo catalog ready: 4 categories and 12 clearly labeled demo products.'))
