from django.core.exceptions import ValidationError
from django.utils.translation import get_language

TRANSLATABLE = {
    'Category': ('name', 'description'),
    'Product': ('name', 'subtitle', 'description', 'ingredients', 'usage', 'details', 'attribute'),
    'ProductVariant': ('name', 'shade', 'size'),
    'ProductImage': ('alt',),
}

def validate_translations(value):
    if not isinstance(value, dict) or set(value) - {'fr'}:
        raise ValidationError('Translations must be an object containing only the fr language.')
    french = value.get('fr', {})
    allowed = set().union(*TRANSLATABLE.values())
    if not isinstance(french, dict) or set(french) - allowed:
        raise ValidationError('Unknown translated field.')
    for field, text in french.items():
        limit = 10000 if field in {'description', 'ingredients', 'usage', 'details'} else 250
        if not isinstance(text, str) or len(text) > limit:
            raise ValidationError(f'Translated {field} must be text of at most {limit} characters.')

def localized(obj, field):
    if (get_language() or '').startswith('fr'):
        return obj.translations.get('fr', {}).get(field) or getattr(obj, field)
    return getattr(obj, field)

class LocalizedRepresentation:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in TRANSLATABLE[type(instance).__name__]:
            if field in data:
                data[field] = localized(instance, field)
        return data
