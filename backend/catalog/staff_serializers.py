from .localization import TRANSLATABLE
import re
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariant, StoreSettings, AuditLog

def safe_image_path(value):
    if value and not (value.startswith('/') and not value.startswith('//') or value.startswith('https://')):
        raise serializers.ValidationError('Use a local /path or an HTTPS URL.')
    return value

def validate_image(image):
    if image and (image.size > 10 * 1024 * 1024 or image.content_type not in ['image/jpeg', 'image/png', 'image/webp']):
        raise serializers.ValidationError('Upload a JPEG, PNG or WebP image up to 10 MB.')
    return image

class TranslationInputMixin:
    def validate_translations(self, value):
        allowed = TRANSLATABLE[self.Meta.model.__name__]
        if set(value.get('fr', {})) - set(allowed):
            raise serializers.ValidationError('Unknown translated field for this item.')
        return value

class StaffImageSerializer(TranslationInputMixin, serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    validate_image = staticmethod(validate_image)
    validate_image_url = staticmethod(safe_image_path)
    def get_url(self, obj):
        return obj.image.url if obj.image else obj.image_url
    def validate(self, attrs):
        if not attrs.get('image', getattr(self.instance, 'image', None)) and not attrs.get('image_url', getattr(self.instance, 'image_url', '')):
            raise serializers.ValidationError('An image file or URL is required.')
        return attrs
    class Meta:
        model = ProductImage
        fields = ['translations', 'id', 'product', 'image', 'image_url', 'url', 'alt', 'position']

class StaffVariantSerializer(TranslationInputMixin, serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['translations', 'id', 'product', 'name', 'sku', 'shade', 'size', 'color', 'price', 'stock', 'position']

class StaffCategorySerializer(TranslationInputMixin, serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    preview_image = serializers.SerializerMethodField()
    validate_image = staticmethod(validate_image)
    validate_image_url = staticmethod(safe_image_path)
    def get_preview_image(self, obj):
        return obj.image.url if obj.image else obj.image_url
    class Meta:
        model = Category
        fields = ['translations', 'id', 'name', 'slug', 'description', 'image', 'image_url', 'preview_image', 'position', 'product_count']

class StaffProductSerializer(TranslationInputMixin, serializers.ModelSerializer):
    images = StaffImageSerializer(many=True, read_only=True)
    variants = StaffVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    stock_total = serializers.IntegerField(read_only=True)
    class Meta:
        model = Product
        fields = ['translations', 'id', 'name', 'slug', 'subtitle', 'category', 'category_name', 'description', 'price', 'stock', 'stock_total', 'ingredients', 'usage', 'details', 'attribute', 'featured', 'is_new', 'is_active', 'is_demo', 'created_at', 'images', 'variants']
        read_only_fields = ['created_at']

class SettingsSerializer(serializers.ModelSerializer):
    logo_preview = serializers.SerializerMethodField()
    clear_logo = serializers.BooleanField(write_only=True, required=False)
    confirm_currency_change = serializers.BooleanField(write_only=True, required=False)
    validate_logo = staticmethod(validate_image)
    validate_logo_url = staticmethod(safe_image_path)
    def get_logo_preview(self, obj):
        return obj.logo.url if obj.logo else obj.logo_url
    def validate_currency(self, value):
        value = value.upper()
        if not re.fullmatch(r'[A-Z]{3}', value):
            raise serializers.ValidationError('Use a three-letter currency code, e.g. USD or NGN.')
        return value
    def validate_locale(self, value):
        if not re.fullmatch(r'[a-z]{2,3}(-[A-Z]{2}|-[A-Z][a-z]{3})?', value):
            raise serializers.ValidationError('Use a locale such as en-US, en-GB or fr-FR.')
        return value
    def validate(self, attrs):
        if self.instance and attrs.get('currency', self.instance.currency) != self.instance.currency and not attrs.get('confirm_currency_change'):
            raise serializers.ValidationError({'currency': 'Confirm that changing currency does not convert catalog prices.'})
        for field in ['instagram_url', 'tiktok_url']:
            if attrs.get(field) and not attrs[field].startswith('https://'):
                raise serializers.ValidationError({field: 'Use an HTTPS URL.'})
        return attrs
    def update(self, instance, attrs):
        attrs.pop('confirm_currency_change', None)
        if attrs.pop('clear_logo', False):
            attrs['logo'] = ''
            attrs['logo_url'] = ''
        return super().update(instance, attrs)
    class Meta:
        model = StoreSettings
        fields = ['currency', 'locale', 'contact_email', 'instagram_url', 'tiktok_url', 'logo_url', 'logo', 'logo_preview', 'low_stock_threshold', 'clear_logo', 'confirm_currency_change']

class AuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'actor_name', 'action', 'target', 'changes', 'created_at']

def is_administrator(user):
    return user.is_authenticated and user.is_staff and (user.is_superuser or user.groups.filter(name='Veloura Administrators').exists())

def user_info(user):
    return {'id': user.id, 'username': user.username, 'first_name': user.first_name, 'email': user.email, 'is_active': user.is_active, 'role': 'Administrator' if is_administrator(user) else 'Catalog Editor', 'permissions': sorted(user.get_all_permissions())}

class StaffUserInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=['Administrator', 'Catalog Editor'])
    is_active = serializers.BooleanField(default=True)
    password = serializers.CharField(write_only=True, required=False, min_length=10, trim_whitespace=False)
    def validate_username(self, value):
        if not re.fullmatch(r'[\w.@+-]+', value):
            raise serializers.ValidationError('Use letters, numbers and @/./+/-/_ only.')
        qs = get_user_model().objects.filter(username=value)
        if self.context.get('user_id'):
            qs = qs.exclude(pk=self.context['user_id'])
        if qs.exists():
            raise serializers.ValidationError('This username is already in use.')
        return value
    def validate(self, attrs):
        if not self.context.get('user_id') and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'A password is required.'})
        if attrs.get('password'):
            user = get_user_model()(username=attrs['username'], email=attrs.get('email', ''))
            try:
                validate_password(attrs['password'], user)
            except DjangoValidationError as error:
                raise serializers.ValidationError({'password': error.messages})
        return attrs
