import hashlib
import json
from decimal import Decimal
from django.db import transaction, IntegrityError, OperationalError
from django.db.models import F, Q
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils.translation import get_language
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .models import Order, OrderItem, Product, ProductVariant, StoreSettings
from .serializers import BagItemInput, BagInput
from .localization import localized
from .staff_views import StaffBase, AdministratorPermission, StaffPagination


class CheckoutConflict(APIException):
    status_code = 409
    default_detail = 'Your bag changed. Review current prices and availability, then submit again.'


class CheckoutLine(BagItemInput):
    expected_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))


class CheckoutInput(serializers.Serializer):
    idempotency_key = serializers.UUIDField()
    items = CheckoutLine(many=True, allow_empty=False, max_length=100)
    currency = serializers.CharField(min_length=3, max_length=3)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = serializers.RegexField(r'^[+\d\s().-]{6,40}$', max_length=40)
    address_line1 = serializers.CharField(max_length=250)
    address_line2 = serializers.CharField(max_length=250, allow_blank=True, default='')
    city = serializers.CharField(max_length=100)
    region = serializers.CharField(max_length=100, allow_blank=True, default='')
    postal_code = serializers.CharField(max_length=30, allow_blank=True, default='')
    country = serializers.CharField(max_length=100)
    notes = serializers.CharField(max_length=2000, allow_blank=True, default='')
    acknowledged = serializers.BooleanField()

    def validate_phone(self, value):
        if sum(character.isdigit() for character in value) < 6:
            raise ValidationError('Enter a valid phone number.')
        return value

    def validate_items(self, value):
        return BagInput().validate_items(value)

    def validate_acknowledged(self, value):
        if not value:
            raise ValidationError('Please acknowledge that this is an unpaid order request.')
        return value


class CheckoutThrottle(AnonRateThrottle):
    scope = 'checkout'
    rate = '20/hour'


def receipt(order):
    # No customer details or publicly accessible order lookup.
    return {'reference': order.reference, 'status': order.status, 'subtotal': str(order.subtotal),
            'currency': order.currency, 'is_demo': order.is_demo, 'payment_status': 'unpaid'}


@method_decorator(csrf_protect, name='dispatch')
class CheckoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [CheckoutThrottle]

    def get_throttles(self):
        return super().get_throttles() if self.request.method == 'POST' else []

    def get(self, request):
        return Response({'csrfToken': get_token(request)})

    def post(self, request):
        serializer = CheckoutInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        key = data.pop('idempotency_key')
        data.pop('acknowledged')
        digest = hashlib.sha256(json.dumps(data, sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()
        existing = Order.objects.filter(idempotency_key=key).first()
        if existing:
            if existing.request_hash != digest:
                raise CheckoutConflict('This request key was already used. Refresh checkout before placing a different order.')
            return Response(receipt(existing))
        lines = data.pop('items')
        try:
            with transaction.atomic():
                store = StoreSettings.current()
                if data['currency'] != store.currency:
                    raise CheckoutConflict()
                products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=[i['product_id'] for i in lines], is_active=True).order_by('id').prefetch_related('variants', 'images')}
                snapshots, subtotal = [], Decimal('0.00')
                for line in lines:
                    product = products.get(line['product_id'])
                    variants = list(product.variants.all()) if product else []
                    variant = next((v for v in variants if v.id == line['variant_id']), None)
                    if not product or (variants and not variant) or (not variants and line['variant_id'] is not None):
                        raise CheckoutConflict()
                    source = variant or product
                    price = variant.price if variant and variant.price is not None else product.price
                    if source.stock < line['quantity'] or price != line['expected_price']:
                        raise CheckoutConflict()
                    total = price * line['quantity']
                    subtotal += total
                    image = next(iter(product.images.all()), None)
                    snapshots.append(dict(product=product, variant=variant, had_variant=bool(variant),
                        product_name=localized(product, 'name'), variant_name=localized(variant, 'name') if variant else '',
                        sku=variant.sku if variant else '', image_url=(image.image.url if image.image else image.image_url) if image else '',
                        unit_price=price, quantity=line['quantity'], line_total=total))
                order = Order.objects.create(**data, idempotency_key=key, request_hash=digest, subtotal=subtotal,
                    language='fr' if (get_language() or '').startswith('fr') else 'en', is_demo=any(p.is_demo for p in products.values()))
                OrderItem.objects.bulk_create([OrderItem(order=order, **item) for item in snapshots])
        except IntegrityError:
            existing = Order.objects.filter(idempotency_key=key, request_hash=digest).first()
            if existing:
                return Response(receipt(existing))
            raise CheckoutConflict()
        except OperationalError:
            raise CheckoutConflict('The store is busy. Please try again; duplicate requests will not create another order.')
        return Response(receipt(order), status=201)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'variant', 'product_name', 'variant_name', 'sku', 'image_url', 'unit_price', 'quantity', 'line_total']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    class Meta:
        model = Order
        exclude = ['idempotency_key', 'request_hash']


def change_order_status(order_id, status):
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        if order.status == status:
            return order
        if status not in [Order.Status.CONFIRMED, Order.Status.CANCELLED] or order.status == Order.Status.CANCELLED:
            raise CheckoutConflict('This order cannot make that status change. Refresh the order.')
        items = list(order.items.order_by('product_id', 'variant_id'))
        products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=[i.product_id for i in items]).order_by('id')}
        variants = {v.id: v for v in ProductVariant.objects.select_for_update().filter(id__in=[i.variant_id for i in items if i.variant_id]).order_by('id')}
        if status == Order.Status.CONFIRMED:
            for item in items:
                product = products.get(item.product_id)
                variant = variants.get(item.variant_id)
                if not product or not product.is_active or (item.had_variant and (not variant or variant.product_id != product.id)) or (not item.had_variant and product.variants.exists()):
                    raise CheckoutConflict('An ordered item is no longer available. Contact the customer before confirming.')
                model = ProductVariant if item.had_variant else Product
                pk = item.variant_id if item.had_variant else item.product_id
                if not model.objects.filter(pk=pk, stock__gte=item.quantity).update(stock=F('stock') - item.quantity):
                    raise CheckoutConflict('Insufficient stock to confirm this order. Refresh inventory and contact the customer.')
        elif order.status == Order.Status.CONFIRMED:
            for item in items:
                model = ProductVariant if item.had_variant else Product
                pk = item.variant_id if item.had_variant else item.product_id
                if pk:
                    model.objects.filter(pk=pk).update(stock=F('stock') + item.quantity)
        order.status = status
        order.save(update_fields=['status', 'updated_at'])
        return order


class OrdersView(StaffBase):
    permission_classes = [AdministratorPermission]

    def get(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        qs = Order.objects.prefetch_related('items')
        if pk is not None:
            return Response(OrderSerializer(get_object_or_404(qs, pk=pk)).data)
        if request.query_params.get('status'):
            qs = qs.filter(status=request.query_params['status'])
        search = request.query_params.get('search', '').strip()[:200]
        if search:
            qs = qs.filter(Q(reference__icontains=search) | Q(full_name__icontains=search) | Q(email__icontains=search))
        page = StaffPagination()
        return page.get_paginated_response(OrderSerializer(page.paginate_queryset(qs, request), many=True).data)

    def patch(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        get_object_or_404(Order, pk=pk)
        if not isinstance(request.data, dict) or set(request.data) != {'status'}:
            raise ValidationError('Only the order status can be changed.')
        try:
            order = change_order_status(pk, request.data['status'])
        except OperationalError:
            raise CheckoutConflict('The store is busy. Please try again; duplicate requests will not create another order.')
        return Response(OrderSerializer(order).data)
