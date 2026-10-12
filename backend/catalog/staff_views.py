from .exceptions import translate_error
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.db.models import Count, Q, Sum, F
from django.db.models.functions import Coalesce
from django.db.models.deletion import ProtectedError
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import viewsets, serializers, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, DjangoModelPermissions, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .models import Category, Product, ProductImage, ProductVariant, StoreSettings, AuditLog
from .staff_serializers import (StaffProductSerializer, StaffCategorySerializer, StaffImageSerializer, StaffVariantSerializer, SettingsSerializer, AuditSerializer, StaffUserInput, is_administrator, user_info)

def ensure_roles():
    for name, admin_role in [('Veloura Administrators', True), ('Veloura Catalog Editors', False)]:
        group, _ = Group.objects.get_or_create(name=name)
        perms = Permission.objects.filter(content_type__app_label='catalog')
        if not admin_role:
            perms = perms.exclude(content_type__model__in=['order', 'orderitem', 'storesettings']).exclude(content_type__model='auditlog') | Permission.objects.filter(content_type__app_label='catalog', codename__in=['view_storesettings', 'view_auditlog'])
        else:
            perms = perms.exclude(content_type__model='auditlog') | Permission.objects.filter(content_type__app_label='catalog', codename='view_auditlog')
        group.permissions.set(perms)

class StaffPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.is_staff and request.user.has_perm('catalog.view_product'))

class AdministratorPermission(StaffPermission):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and is_administrator(request.user)

class CatalogPermissions(DjangoModelPermissions):
    perms_map = {**DjangoModelPermissions.perms_map, 'GET': ['%(app_label)s.view_%(model_name)s']}

class StaffBase(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [StaffPermission]

class CsrfView(StaffBase):
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({'csrfToken': get_token(request)})

class LoginThrottle(AnonRateThrottle):
    rate = '10/min'
    scope = 'staff_login'

@method_decorator(csrf_protect, name='dispatch')
class LoginView(StaffBase):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]
    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 150 or len(password) > 1024:
            raise ValidationError('Enter a valid username and password.')
        user = authenticate(request, username=username, password=password)
        if not user or not user.is_staff or not user.has_perm('catalog.view_product'):
            return Response({'detail': translate_error('Unable to sign in with those credentials.')}, status=400)
        login(request, user)
        request.session.set_expiry(60 * 60 * 8)
        return Response({'user': user_info(user), 'csrfToken': get_token(request)})

class SessionView(StaffBase):
    def get(self, request):
        return Response({'user': user_info(request.user), 'csrfToken': get_token(request)})

class LogoutView(StaffBase):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Signed out.'})

class StaffPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100

class StaffViewSet(viewsets.ModelViewSet):
    authentication_classes = [SessionAuthentication]
    permission_classes = [StaffPermission, CatalogPermissions]
    pagination_class = StaffPagination
    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save()
    def perform_update(self, serializer):
        with transaction.atomic():
            serializer.save()
    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.delete()

class ProductViewSet(StaffViewSet):
    queryset = Product.objects.all()
    serializer_class = StaffProductSerializer
    def get_queryset(self):
        qs = Product.objects.select_related('category').prefetch_related('images', 'variants').annotate(stock_total=Coalesce(Sum('variants__stock'), F('stock')))
        p = self.request.query_params
        if p.get('search'):
            qs = qs.filter(Q(name__icontains=p['search'][:200]) | Q(slug__icontains=p['search'][:200]))
        if p.get('category'):
            if not p['category'].isdigit():
                raise ValidationError({'category': 'Choose a category.'})
            qs = qs.filter(category_id=p['category'])
        for field in ['is_active', 'is_demo', 'featured']:
            if p.get(field) in ['true', 'false']:
                qs = qs.filter(**{field: p[field] == 'true'})
        if p.get('stock') == 'out':
            qs = qs.filter(stock_total=0)
        elif p.get('stock') == 'low':
            qs = qs.filter(stock_total__gt=0, stock_total__lte=StoreSettings.current().low_stock_threshold)
        order = p.get('ordering', '-created_at')
        if order not in ['name', '-name', 'price', '-price', '-created_at', 'stock_total', '-stock_total']:
            raise ValidationError({'ordering': 'Invalid sort order.'})
        return qs.order_by(order, 'id')

    @action(detail=True, methods=['post'])
    def reorder_images(self, request, pk=None):
        if not request.user.has_perm('catalog.change_productimage'):
            raise PermissionDenied()
        product = self.get_object()
        ids = request.data.get('ids')
        expected = set(product.images.values_list('id', flat=True))
        if not isinstance(ids, list) or any(type(i) is not int for i in ids) or len(ids) != len(expected) or set(ids) != expected:
            raise ValidationError('Include each image ID exactly once.')
        with transaction.atomic():
            for position, image_id in enumerate(ids):
                image = product.images.get(pk=image_id)
                image.position = position
                image.save(update_fields=['position'])
        return Response({'detail': 'Image order saved.'})

class CategoryViewSet(StaffViewSet):
    queryset = Category.objects.annotate(product_count=Count('products')).order_by('position', 'name')
    serializer_class = StaffCategorySerializer
    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except ProtectedError:
            raise ValidationError('Move this category’s products to another category before deleting it.')

class ImageViewSet(StaffViewSet):
    queryset = ProductImage.objects.all()
    serializer_class = StaffImageSerializer

class VariantViewSet(StaffViewSet):
    queryset = ProductVariant.objects.all()
    serializer_class = StaffVariantSerializer

class OverviewView(StaffBase):
    def get(self, request):
        settings = StoreSettings.current()
        products = list(Product.objects.prefetch_related('variants', 'images').select_related('category'))
        alerts, incomplete = [], []
        out = low = 0
        for p in products:
            variants = list(p.variants.all())
            inventory = [(v.id, f'{p.name} · {v.name}', v.stock) for v in variants] if variants else [(None, p.name, p.stock)]
            for variant_id, name, stock in inventory:
                if stock == 0:
                    out += 1
                elif stock <= settings.low_stock_threshold:
                    low += 1
                if stock <= settings.low_stock_threshold:
                    alerts.append({'product_id': p.id, 'variant_id': variant_id, 'name': name, 'stock': stock, 'is_active': p.is_active})
            missing = [label for label, value in [('images', list(p.images.all())), ('ingredients', p.ingredients.strip()), ('usage', p.usage.strip())] if not value]
            if missing:
                incomplete.append({'id': p.id, 'name': p.name, 'missing': missing})
        return Response({'total_products': len(products), 'active_products': sum(p.is_active for p in products), 'featured_products': sum(p.featured for p in products), 'categories': Category.objects.count(), 'out_of_stock': out, 'low_stock': low, 'low_stock_threshold': settings.low_stock_threshold, 'incomplete_count': len(incomplete), 'alerts': sorted(alerts, key=lambda a: a['stock'])[:10], 'incomplete': incomplete[:10], 'recent_activity': AuditSerializer(AuditLog.objects.all()[:6], many=True).data, 'currency': settings.currency, 'locale': settings.locale})

class InventoryInput(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    variant_id = serializers.IntegerField(min_value=1, allow_null=True, default=None)
    stock = serializers.IntegerField(min_value=0, max_value=2147483647)
    expected_stock = serializers.IntegerField(min_value=0)

class InventoryView(StaffBase):
    def get(self, request):
        threshold = StoreSettings.current().low_stock_threshold
        rows = []
        products = Product.objects.prefetch_related('variants').select_related('category').order_by('name')
        term = request.query_params.get('search', '').strip().lower()[:200]
        for p in products:
            variants = list(p.variants.all())
            for v in variants or [None]:
                row = {'product_id': p.id, 'variant_id': v.id if v else None, 'name': p.name, 'variant': v.name if v else '', 'sku': v.sku if v else f'PRODUCT-{p.id}', 'stock': v.stock if v else p.stock, 'category': p.category.name, 'is_active': p.is_active}
                if term and term not in f"{row['name']} {row['variant']} {row['sku']}".lower():
                    continue
                stock_filter = request.query_params.get('stock')
                if stock_filter == 'out' and row['stock'] != 0 or stock_filter == 'low' and not 0 < row['stock'] <= threshold:
                    continue
                rows.append(row)
        paginator = StaffPagination()
        return paginator.get_paginated_response(paginator.paginate_queryset(rows, request))

    @transaction.atomic
    def patch(self, request):
        serializer = InventoryInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        product = get_object_or_404(Product.objects.select_for_update(), pk=data['product_id'])
        obj = get_object_or_404(ProductVariant.objects.select_for_update(), pk=data['variant_id'], product=product) if data['variant_id'] else product
        permission = 'catalog.change_productvariant' if data['variant_id'] else 'catalog.change_product'
        if not request.user.has_perm(permission):
            raise PermissionDenied()
        if obj == product and product.variants.exists():
            raise ValidationError('This product uses variant stock. Update a variant instead.')
        if obj.stock != data['expected_stock']:
            return Response({'detail': 'Stock changed since you opened this row. Refresh before saving.', 'current_stock': obj.stock}, status=409)
        obj.stock = data['stock']
        obj.save(update_fields=['stock'])
        return Response({'stock': obj.stock})

class SettingsView(StaffBase):
    def get(self, request):
        return Response(SettingsSerializer(StoreSettings.current()).data)
    @transaction.atomic
    def patch(self, request):
        if not is_administrator(request.user) or not request.user.has_perm('catalog.change_storesettings'):
            raise PermissionDenied('Only administrators can change store settings.')
        serializer = SettingsSerializer(StoreSettings.current(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class ActivityView(StaffBase):
    def get(self, request):
        if not request.user.has_perm('catalog.view_auditlog'):
            raise PermissionDenied()
        paginator = StaffPagination()
        qs = AuditLog.objects.all()
        if request.query_params.get('search'):
            term = request.query_params['search'][:200]
            qs = qs.filter(Q(target__icontains=term) | Q(actor_name__icontains=term))
        return paginator.get_paginated_response(AuditSerializer(paginator.paginate_queryset(qs, request), many=True).data)

class UsersView(StaffBase):
    permission_classes = [AdministratorPermission]
    def get(self, request):
        return Response([user_info(u) for u in get_user_model().objects.filter(is_staff=True).prefetch_related('groups').order_by('username')])
    @transaction.atomic
    def post(self, request):
        serializer = StaffUserInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.save_user(request, serializer.validated_data)
    @transaction.atomic
    def patch(self, request, pk):
        user = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk, is_staff=True)
        if user.is_superuser:
            raise ValidationError('Manage the owner account with Django Admin or the management command.')
        if user.pk == request.user.pk:
            raise ValidationError('You cannot change your own access from this screen.')
        serializer = StaffUserInput(data=request.data, context={'user_id': pk})
        serializer.is_valid(raise_exception=True)
        return self.save_user(request, serializer.validated_data, user)
    def save_user(self, request, data, user=None):
        ensure_roles()
        created = user is None
        user = user or get_user_model()()
        for field in ['username', 'first_name', 'email', 'is_active']:
            if field in data:
                setattr(user, field, data[field])
        user.is_staff = True
        if data.get('password'):
            user.set_password(data['password'])
        user.save()
        user.groups.set([Group.objects.get(name='Veloura Administrators' if data['role'] == 'Administrator' else 'Veloura Catalog Editors')])
        user.user_permissions.clear()
        AuditLog.objects.create(actor=request.user, actor_name=request.user.username, action='created' if created else 'updated', target=f'Staff: {user.username}', changes={'role': {'after': data['role']}, 'is_active': {'after': user.is_active}})
        return Response(user_info(user), status=201 if created else 200)
