from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [path('i18n/', include('django.conf.urls.i18n')), path('admin/', admin.site.urls), path('api/staff/', include('catalog.staff_urls')), path('api/', include('catalog.urls'))]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
