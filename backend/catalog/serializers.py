from .localization import LocalizedRepresentation
from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariant

class CategorySerializer(LocalizedRepresentation, serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    def get_image_url(self, obj):
        return obj.image.url if obj.image else obj.image_url
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image_url']

class ImageSerializer(LocalizedRepresentation, serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    def get_url(self, obj):
        return obj.image.url if obj.image else obj.image_url
    class Meta:
        model = ProductImage
        fields = ['id', 'url', 'alt']

class VariantSerializer(LocalizedRepresentation, serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    def get_price(self, obj):
        return str(obj.price if obj.price is not None else obj.product.price)
    class Meta:
        model = ProductVariant
        fields = ['id', 'name', 'shade', 'color', 'size', 'price', 'stock']

class ProductSerializer(LocalizedRepresentation, serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    images = ImageSerializer(many=True, read_only=True)
    variants = VariantSerializer(many=True, read_only=True)
    available = serializers.SerializerMethodField()
    display_price = serializers.SerializerMethodField()
    def get_available(self, obj):
        variants = list(obj.variants.all())
        return any(v.stock > 0 for v in variants) if variants else obj.stock > 0
    def get_display_price(self, obj):
        variants = list(obj.variants.all())
        return str(min((v.price if v.price is not None else obj.price for v in variants), default=obj.price))
    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'subtitle', 'description', 'price', 'display_price', 'stock', 'available', 'ingredients', 'usage', 'details', 'attribute', 'featured', 'is_new', 'is_demo', 'category', 'images', 'variants']

class BagItemInput(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    variant_id = serializers.IntegerField(min_value=1, allow_null=True, default=None)
    quantity = serializers.IntegerField(min_value=1, max_value=99)

class BagInput(serializers.Serializer):
    items = BagItemInput(many=True, max_length=100)
    def validate_items(self, items):
        keys = [(i['product_id'], i['variant_id']) for i in items]
        if len(keys) != len(set(keys)):
            raise serializers.ValidationError('Duplicate bag lines are not allowed.')
        return items
