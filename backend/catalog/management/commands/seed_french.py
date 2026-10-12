from django.core.management.base import BaseCommand
from django.db import transaction
from catalog.models import Category, Product

CATEGORIES = {
    'skincare': ('Soins du visage', 'Un peu de soin. Un rituel quotidien. Découvrez des textures et des touches finales pour vos soins du visage.'),
    'makeup': ('Maquillage', 'Des couleurs qui vous ressemblent. Découvrez une sélection de teintes pour vous exprimer au quotidien.'),
    'haircare': ('Soins capillaires', 'Faites une place à votre rituel capillaire, du premier lavage à la dernière touche.'),
    'body-care': ('Soins du corps', 'Des moments du quotidien choisis avec soin. Découvrez votre prochain rituel pour le corps.'),
}
PRODUCTS = {
    'dew-drop-serum': ('Sérum Rosée', 'Un instant d’éclat au quotidien', 'Sérum'),
    'rose-veil-lip-color': ('Rouge à lèvres Voile de Rose', 'Votre teinte signature, tout en douceur', 'Rouge à lèvres'),
    'the-daily-cream': ('La Crème Quotidienne', 'Une touche de douceur dans votre rituel', 'Crème hydratante'),
    'botanical-body-oil': ('Huile Botanique pour le Corps', 'Une touche finale à savourer sans hâte', 'Huile pour le corps'),
    'silk-ritual-hair-oil': ('Huile Capillaire Rituel de Soie', 'La dernière touche de votre rituel capillaire', 'Huile capillaire'),
    'soft-bloom-blush': ('Fard à Joues Fleur Douce', 'Un peu de couleur. Un peu de confiance.', 'Fard à joues'),
    'evening-cleansing-oil': ('Huile Nettoyante du Soir', 'Laissez la journée s’effacer en douceur', 'Nettoyant'),
    'the-body-souffle': ('Le Soufflé pour le Corps', 'Un quotidien qui sort de l’ordinaire', 'Crème pour le corps'),
    'morning-mist': ('Brume du Matin', 'Une pause dans votre routine matinale', 'Brume'),
    'everyday-hair-wash': ('Shampooing Quotidien', 'Un nouveau départ pour votre rituel', 'Shampooing'),
    'nude-notes-lip-color': ('Rouge à Lèvres Notes Nude', 'Une couleur discrète, à votre image', 'Rouge à lèvres'),
    'velvet-body-wash': ('Gel Douche Velours', 'Une invitation à ralentir', 'Gel douche'),
}

def fill(instance, fields):
    current = instance.translations.get('fr', {})
    missing = {key: value for key, value in fields.items() if key not in current}
    if missing:
        instance.translations = {'fr': {**current, **missing}}
        instance.save(update_fields=['translations'])

class Command(BaseCommand):
    help = 'Add missing French translations to the sample catalog, without changing prices, stock or publication.'

    @transaction.atomic
    def handle(self, *args, **options):
        for category in Category.objects.filter(slug__in=CATEGORIES):
            name, description = CATEGORIES[category.slug]
            fill(category, {'name': name, 'description': description})
        for product in Product.objects.filter(is_demo=True, slug__in=PRODUCTS):
            name, subtitle, attribute = PRODUCTS[product.slug]
            fill(product, {
                'name': name, 'subtitle': subtitle, 'attribute': attribute,
                'description': f'{subtitle}. {name} fait partie de notre collection Veloura imaginée avec soin pour faire une place à la beauté au quotidien. Découvrez ce produit de démonstration pour imaginer votre propre rituel.',
                'ingredients': 'Produit de démonstration : aucune liste d’ingrédients vérifiée n’a été fournie. Remplacez ce texte par la liste complète du fabricant avant publication.',
                'usage': 'Produit de démonstration : les conseils d’utilisation seront fournis avec le produit final. Suivez les instructions figurant sur l’emballage de votre produit réel.',
                'details': 'Article illustratif du catalogue. Les noms, les visuels d’emballages générés, les prix et les stocks sont fournis uniquement à titre de démonstration. Les photos sont partagées entre plusieurs exemples ; l’emballage final peut différer.',
            })
            for image in product.images.all():
                fill(image, {'alt': f'Visuel de démonstration Veloura : {name}'})
            for variant in product.variants.all():
                shade = {'Rosewood': 'Bois de rose', 'Petal': 'Pétale', 'Terracotta': 'Terre cuite'}.get(variant.name, variant.name)
                fill(variant, {'name': shade, 'shade': shade if variant.shade else '', 'size': variant.size})
        self.stdout.write(self.style.SUCCESS('Missing French demo translations added. Existing translations and catalog state preserved.'))
