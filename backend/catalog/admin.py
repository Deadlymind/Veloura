from django.contrib import admin
from .models import Category, Product, ProductImage, ProductVariant, StoreSettings, AuditLog

class ImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

class VariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'stock', 'featured', 'is_active', 'is_demo']
    list_filter = ['category', 'featured', 'is_new', 'is_active', 'is_demo']
    search_fields = ['name', 'description', 'variants__sku']
    prepopulated_fields = {'slug': ['name']}
    inlines = [ImageInline, VariantInline]

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'position']
    prepopulated_fields = {'slug': ['name']}

admin.site.site_header = 'Veloura · Catalog'
admin.site.site_title = 'Veloura Admin'
admin.site.index_title = 'Your beauty collection'

@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not StoreSettings.objects.exists() and super().has_add_permission(request)
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'actor_name', 'action', 'target']
    search_fields = ['actor_name', 'target']
    readonly_fields = ['actor', 'actor_name', 'action', 'target', 'changes', 'created_at']
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False


from .models import Order, OrderItem
from .checkout import change_order_status
from rest_framework.exceptions import APIException

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = [f.name for f in OrderItem._meta.fields]
    def has_add_permission(self, request, obj=None):
        return False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['reference', 'full_name', 'status', 'subtotal', 'currency', 'is_demo', 'created_at']
    list_filter = ['status', 'is_demo']
    search_fields = ['reference', 'full_name', 'email']
    readonly_fields = [f.name for f in Order._meta.fields if f.name not in ['idempotency_key', 'request_hash']]
    exclude = ['idempotency_key', 'request_hash']
    inlines = [OrderItemInline]
    actions = ['confirm_requests', 'cancel_requests']
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
    @admin.action(description='Confirm requests and reserve stock')
    def confirm_requests(self, request, queryset):
        self.transition(request, queryset, 'confirmed')
    @admin.action(description='Cancel requests and release reserved stock')
    def cancel_requests(self, request, queryset):
        self.transition(request, queryset, 'cancelled')
    def transition(self, request, queryset, status):
        for order in queryset:
            try:
                change_order_status(order.id, status)
                self.message_user(request, f'{order.reference}: {status}')
            except APIException as error:
                self.message_user(request, f'{order.reference}: {error.detail}', level='error')
