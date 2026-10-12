from .localization import validate_translations
from decimal import Decimal
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Qimport uuiddef order_reference():    return 'VL-' + uuid.uuid4().hex[:16].upper()


class Category(models.Model):
    translations = models.JSONField(default=dict, blank=True, validators=[validate_translations], help_text='Optional French fields, e.g. {"fr": {"name": "Nom français"}}. Empty values fall back to English.')
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    image_url = models.CharField(max_length=500, blank=True, help_text='Local /images/ path or HTTPS URL.')
    position = models.PositiveSmallIntegerField(default=0)
    image = models.ImageField(upload_to='categories/', blank=True)

    class Meta:
        ordering = ['position', 'name']

    def __str__(self):
        return self.name


class Product(models.Model):
    translations = models.JSONField(default=dict, blank=True, validators=[validate_translations], help_text='Optional French fields, e.g. {"fr": {"name": "Nom français"}}. Empty values fall back to English.')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    stock = models.PositiveIntegerField(default=0, help_text='Used only for products without variants.')
    ingredients = models.TextField(blank=True)
    usage = models.TextField(blank=True)
    details = models.TextField(blank=True)
    attribute = models.CharField(max_length=60, blank=True, help_text='Filterable product type, e.g. Serum or Lip color.')
    featured = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.CheckConstraint(condition=Q(price__gt=0), name='product_positive_price')]

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    translations = models.JSONField(default=dict, blank=True, validators=[validate_translations], help_text='Optional French fields, e.g. {"fr": {"name": "Nom français"}}. Empty values fall back to English.')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/%Y/%m/', blank=True)
    image_url = models.CharField(max_length=500, blank=True, help_text='Fallback: local /images/ path or HTTPS URL.')
    alt = models.CharField(max_length=250)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.image and not self.image_url:
            raise ValidationError('Upload an image or provide an image URL.')
        if self.image_url and not self.image_url.startswith(('/', 'https://')):
            raise ValidationError({'image_url': 'Use a local path or HTTPS URL.'})
        if self.image and self.image.size > 10 * 1024 * 1024:
            raise ValidationError({'image': 'Images must be 10 MB or smaller.'})

    def __str__(self):
        return self.alt


class ProductVariant(models.Model):
    translations = models.JSONField(default=dict, blank=True, validators=[validate_translations], help_text='Optional French fields, e.g. {"fr": {"name": "Nom français"}}. Empty values fall back to English.')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    name = models.CharField(max_length=100)
    sku = models.CharField(max_length=100, unique=True)
    shade = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=7, blank=True, validators=[RegexValidator(r'^#[0-9a-fA-F]{6}$', 'Use a six-digit hex color.')])
    size = models.CharField(max_length=50, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0.01'))], help_text='Leave empty to use product price.')
    stock = models.PositiveIntegerField(default=0)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']
        constraints = [models.CheckConstraint(condition=Q(price__isnull=True) | Q(price__gt=0), name='variant_positive_price')]

    def __str__(self):
        return f'{self.product.name} — {self.name}'


class StoreSettings(models.Model):
    currency = models.CharField(max_length=3, default='USD')
    locale = models.CharField(max_length=30, default='en-US')
    contact_email = models.EmailField(blank=True)
    instagram_url = models.URLField(blank=True)
    tiktok_url = models.URLField(blank=True)
    logo_url = models.CharField(max_length=500, blank=True)
    logo = models.ImageField(upload_to='branding/', blank=True)
    low_stock_threshold = models.PositiveSmallIntegerField(default=5)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def current(cls):
        from django.conf import settings
        return cls.objects.get_or_create(pk=1, defaults={
            'currency': settings.STORE_CURRENCY, 'locale': settings.STORE_LOCALE,
            'contact_email': settings.STORE_CONTACT_EMAIL, 'instagram_url': settings.STORE_INSTAGRAM_URL,
            'tiktok_url': settings.STORE_TIKTOK_URL, 'logo_url': settings.STORE_LOGO_URL,
        })[0]

    def __str__(self):
        return 'Veloura store settings'


class AuditLog(models.Model):
    actor = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL)
    actor_name = models.CharField(max_length=150, default='System')
    action = models.CharField(max_length=20)
    target = models.CharField(max_length=250)
    changes = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']class Order(models.Model):    class Status(models.TextChoices):        PENDING = 'pending', 'Pending confirmation'        CONFIRMED = 'confirmed', 'Confirmed — unpaid'        CANCELLED = 'cancelled', 'Cancelled'    reference = models.CharField(max_length=19, unique=True, default=order_reference, editable=False)    idempotency_key = models.UUIDField(unique=True, editable=False)    request_hash = models.CharField(max_length=64, editable=False)    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)    full_name = models.CharField(max_length=150)    email = models.EmailField()    phone = models.CharField(max_length=40)    address_line1 = models.CharField(max_length=250)    address_line2 = models.CharField(max_length=250, blank=True)    city = models.CharField(max_length=100)    region = models.CharField(max_length=100, blank=True)    postal_code = models.CharField(max_length=30, blank=True)    country = models.CharField(max_length=100)    notes = models.TextField(blank=True, max_length=2000)    language = models.CharField(max_length=2, choices=[('en', 'English'), ('fr', 'French')], default='en')    currency = models.CharField(max_length=3)    subtotal = models.DecimalField(max_digits=18, decimal_places=2)    is_demo = models.BooleanField(default=False)    created_at = models.DateTimeField(auto_now_add=True)    updated_at = models.DateTimeField(auto_now=True)    class Meta:        ordering = ['-created_at', '-id']    def __str__(self):        return self.referenceclass OrderItem(models.Model):    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)    had_variant = models.BooleanField(default=False)    product_name = models.CharField(max_length=250)    variant_name = models.CharField(max_length=250, blank=True)    sku = models.CharField(max_length=100, blank=True)    image_url = models.CharField(max_length=500, blank=True)    unit_price = models.DecimalField(max_digits=10, decimal_places=2)    quantity = models.PositiveSmallIntegerField()    line_total = models.DecimalField(max_digits=18, decimal_places=2)    class Meta:        ordering = ['id']        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0), name='order_item_positive_quantity')]
