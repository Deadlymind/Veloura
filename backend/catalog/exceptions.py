import json
from pathlib import Path
from django.utils.translation import get_language
from rest_framework.views import exception_handler

FRENCH = json.loads(Path(__file__).with_name('french_errors.json').read_text(encoding='utf-8'))

def translate_error(value):
    if not (get_language() or '').startswith('fr'):
        return value
    if isinstance(value, dict):
        return {key: translate_error(text) for key, text in value.items()}
    if isinstance(value, list):
        return [translate_error(text) for text in value]
    if isinstance(value, str):
        return FRENCH.get(str(value), value)
    return value

def localized_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = translate_error(response.data)
    return response
