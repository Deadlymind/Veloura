from contextvars import ContextVar
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import Product, ProductVariant, ProductImage, Category, StoreSettings, AuditLog, Order

actor_context = ContextVar('catalog_actor', default=None)
TRACKED = {
    Order: ['status'],
    Product: ['translations', 'name', 'slug', 'price', 'stock', 'is_active', 'category_id', 'featured', 'is_new', 'is_demo', 'subtitle', 'description', 'ingredients', 'usage', 'details', 'attribute'],
    ProductVariant: ['translations', 'name', 'sku', 'price', 'stock', 'shade', 'size', 'color', 'position'],
    ProductImage: ['translations', 'alt', 'image', 'image_url', 'position'],
    Category: ['translations', 'name', 'slug', 'description', 'position', 'image', 'image_url'],
    StoreSettings: ['currency', 'locale', 'contact_email', 'instagram_url', 'tiktok_url', 'logo', 'logo_url', 'low_stock_threshold'],
}

def snapshot(instance):
    return {name: str(getattr(instance, name)) for name in TRACKED[type(instance)]}

def record(action, instance, changes):
    user = actor_context.get()
    AuditLog.objects.create(actor=user if user and user.is_authenticated else None,
        actor_name=user.username if user and user.is_authenticated else 'System',
        action=action, target=f'{instance._meta.verbose_name}: {instance}'[:250], changes=changes)

@receiver(pre_save)
def before_save(sender, instance, **kwargs):
    if sender not in TRACKED:
        return
    previous = sender.objects.filter(pk=instance.pk).first() if instance.pk else None
    instance._audit_before = snapshot(previous) if previous else {}

@receiver(post_save)
def after_save(sender, instance, created, **kwargs):
    if sender not in TRACKED:
        return
    before = getattr(instance, '_audit_before', {})
    changes = {k: {'before': before.get(k), 'after': value} for k, value in snapshot(instance).items() if value != before.get(k)}
    if changes:
        record('created' if created else 'updated', instance, changes)

@receiver(post_delete)
def after_delete(sender, instance, **kwargs):
    if sender in TRACKED:
        record('deleted', instance, {k: {'before': value, 'after': None} for k, value in snapshot(instance).items()})

class AuditActorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = actor_context.set(request.user)
        try:
            return self.get_response(request)
        finally:
            actor_context.reset(token)
