from django.utils.translation import get_language
from .localization import localized
from decimal import Decimal, InvalidOperation
from django.conf import settings
from django.db.models import Exists, OuterRef, Min, F, DecimalField, Q
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Category, Product, ProductVariant, StoreSettings
from .serializers import CategorySerializer, ProductSerializer, BagInput


class CatalogPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = 'page_size'
    max_page_size = 48

class Categories(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class Products(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = CatalogPagination
    def get_queryset(self):
        params = self.request.query_params
        variants = ProductVariant.objects.filter(product=OuterRef('pk'))
        qs = Product.objects.filter(is_active=True).select_related('category').prefetch_related('images', 'variants')
        qs = qs.annotate(has_variants=Exists(variants), variant_available=Exists(variants.filter(stock__gt=0)), effective_price=Coalesce(Min(Coalesce('variants__price', F('price'), output_field=DecimalField())), F('price')))
        category = params.get('category')
        if category and category != 'all':
            qs = qs.filter(category__slug=category)
        search = params.get('search', '').strip()[:200]
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(category__name__icontains=search) | Q(translations__fr__name__icontains=search) | Q(translations__fr__description__icontains=search) | Q(category__translations__fr__name__icontains=search))
        for key, op in [('min_price', 'gte'), ('max_price', 'lte')]:
            value = params.get(key)
            if value:
                try:
                    price = Decimal(value)
                    if not price.is_finite() or price < 0 or price > 99999999:
                        raise InvalidOperation
                except InvalidOperation:
                    raise ValidationError({key: 'Enter a valid non-negative price.'})
                qs = qs.filter(**{f'effective_price__{op}': price})
        if params.get('min_price') and params.get('max_price') and Decimal(params['min_price']) > Decimal(params['max_price']):
            raise ValidationError({'max_price': 'Maximum price must be at least the minimum.'})
        available = Q(has_variants=True, variant_available=True) | Q(has_variants=False, stock__gt=0)
        if params.get('availability') == 'in-stock':
            qs = qs.filter(available)
        elif params.get('availability') == 'out-of-stock':
            qs = qs.exclude(available)
        elif params.get('availability'):
            raise ValidationError({'availability': 'Choose in-stock or out-of-stock.'})
        if params.get('attribute'):
            qs = qs.filter(attribute=params['attribute'])
        for key in ['featured', 'is_new']:
            if params.get(key):
                if params[key] not in ['true', 'false']:
                    raise ValidationError({key: 'Use true or false.'})
                qs = qs.filter(**{key: params[key] == 'true'})
        ordering = params.get('ordering', 'newest')
        if ordering not in ['newest', 'price', '-price']:
            raise ValidationError({'ordering': 'Choose newest, price, or -price.'})
        return qs.order_by({'newest': '-created_at', 'price': 'effective_price', '-price': '-effective_price'}[ordering], '-id')

class ProductDetail(generics.RetrieveAPIView):
    queryset = Product.objects.filter(is_active=True).select_related('category').prefetch_related('images', 'variants')
    serializer_class = ProductSerializer
    lookup_field = 'slug'

class CatalogConfig(APIView):
    def get(self, request):
        qs = Product.objects.filter(is_active=True)
        store = StoreSettings.current()
        return Response({'currency': store.currency, 'locale': 'fr-FR' if (get_language() or '').startswith('fr') else store.locale, 'contact_email': store.contact_email, 'instagram_url': store.instagram_url, 'tiktok_url': store.tiktok_url, 'logo_url': store.logo.url if store.logo else store.logo_url, 'demo_mode': qs.filter(is_demo=True).exists(), 'attributes': list({(p.category.slug, p.attribute): {'category__slug': p.category.slug, 'attribute': p.attribute, 'label': localized(p, 'attribute')} for p in qs.exclude(attribute='').select_related('category').order_by('attribute')}.values())})

class ValidateBag(APIView):
    def post(self, request):
        serializer = BagInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data['items']
        products = {p.id: p for p in Product.objects.filter(id__in=[i['product_id'] for i in items], is_active=True).prefetch_related('variants', 'images')}
        result, subtotal = [], Decimal('0.00')
        for item in items:
            product = products.get(item['product_id'])
            variants = list(product.variants.all()) if product else []
            variant = next((v for v in variants if v.id == item['variant_id']), None)
            valid = product is not None and (variant is not None if variants else item['variant_id'] is None)
            stock = (variant.stock if variant else product.stock) if valid else 0
            quantity = min(item['quantity'], stock, 99)
            price = (variant.price if variant and variant.price is not None else product.price) if valid else Decimal('0.00')
            total = price * quantity
            subtotal += total
            pic = next(iter(product.images.all()), None) if product else None
            result.append({**item, 'requested_quantity': item['quantity'], 'quantity': quantity, 'stock': stock, 'price': str(price), 'line_total': str(total), 'name': localized(product, 'name') if product else ('Produit indisponible' if (get_language() or '').startswith('fr') else 'Unavailable product'), 'slug': product.slug if product else '', 'variant_name': localized(variant, 'name') if variant else '', 'image': (pic.image.url if pic.image else pic.image_url) if pic else '', 'message': ('This item is no longer available.' if not valid else 'Currently out of stock.' if stock == 0 else f'Only {stock} available; quantity updated.' if quantity < item['quantity'] else '')})
        if (get_language() or '').startswith('fr'):
            for line in result:
                message = line['message']
                line['message'] = ('Cet article n’est plus disponible.' if message == 'This item is no longer available.' else 'Actuellement en rupture de stock.' if message == 'Currently out of stock.' else f"Seulement {line['stock']} disponible(s) ; quantité ajustée." if message else '')
        store = StoreSettings.current()
        return Response({'items': result, 'subtotal': str(subtotal), 'currency': store.currency, 'locale': 'fr-FR' if (get_language() or '').startswith('fr') else store.locale})
