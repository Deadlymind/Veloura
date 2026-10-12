import os

import re

from pathlib import Path

import dj_database_url

from dotenv import load_dotenv

from django.core.exceptions import ImproperlyConfigured



BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() == 'true'

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')

if not SECRET_KEY:

    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY in backend/.env. See .env.example.')

ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'corsheaders', 'rest_framework', 'django_filters', 'catalog']

MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'corsheaders.middleware.CorsMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.locale.LocaleMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'catalog.audit.AuditActorMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']

ROOT_URLCONF = 'config.urls'

TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [BASE_DIR / 'templates'], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {'default': dj_database_url.config(default=f'sqlite:///{BASE_DIR / "db.sqlite3"}', conn_max_age=60)}

AUTH_PASSWORD_VALIDATORS = [{'NAME': f'django.contrib.auth.password_validation.{name}'} for name in ['UserAttributeSimilarityValidator', 'MinimumLengthValidator', 'CommonPasswordValidator', 'NumericPasswordValidator']]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'

STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'

MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')

CSRF_TRUSTED_ORIGINS = [v for v in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',') if v]

# The local tunnel launcher records only its exact temporary HTTPS origin.
_tunnel_origin_file = BASE_DIR / '.tunnel-origin'
if _tunnel_origin_file.exists():
    _tunnel_origin = _tunnel_origin_file.read_text(encoding='utf-8-sig').strip()
    if re.fullmatch(r'https://[a-z0-9-]+\.trycloudflare\.com', _tunnel_origin):
        CSRF_TRUSTED_ORIGINS.append(_tunnel_origin)

REST_FRAMEWORK = {'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'], 'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'], 'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'], 'DEFAULT_THROTTLE_RATES': {'anon': '300/min'}}

STORE_CURRENCY = os.getenv('STORE_CURRENCY', 'USD').upper()

if not re.fullmatch(r'[A-Z]{3}', STORE_CURRENCY):

    raise ImproperlyConfigured('STORE_CURRENCY must be a three-letter currency code.')

STORE_LOCALE = os.getenv('STORE_LOCALE', 'en-US')

STORE_CONTACT_EMAIL = os.getenv('STORE_CONTACT_EMAIL', '')

STORE_INSTAGRAM_URL = os.getenv('STORE_INSTAGRAM_URL', '')

STORE_TIKTOK_URL = os.getenv('STORE_TIKTOK_URL', '')

STORE_LOGO_URL = os.getenv('STORE_LOGO_URL', '')

SECURE_CONTENT_TYPE_NOSNIFF = True

SESSION_COOKIE_SECURE = not DEBUG

CSRF_COOKIE_SECURE = not DEBUG

X_FRAME_OPTIONS = 'DENY'



LANGUAGES = [('en', 'English'), ('fr', 'Français')]

LOCALE_PATHS = [BASE_DIR / 'locale']


REST_FRAMEWORK['EXCEPTION_HANDLER'] = 'catalog.exceptions.localized_exception_handler'
