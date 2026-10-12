from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .staff_views import *
from .checkout import OrdersView

router = DefaultRouter()
router.register('products', ProductViewSet)
router.register('categories', CategoryViewSet)
router.register('images', ImageViewSet)
router.register('variants', VariantViewSet)
urlpatterns = [path('orders/', OrdersView.as_view()), path('orders/<int:pk>/', OrdersView.as_view()), path('csrf/', CsrfView.as_view()), path('login/', LoginView.as_view()), path('logout/', LogoutView.as_view()), path('session/', SessionView.as_view()), path('overview/', OverviewView.as_view()), path('inventory/', InventoryView.as_view()), path('settings/', SettingsView.as_view()), path('activity/', ActivityView.as_view()), path('users/', UsersView.as_view()), path('users/<int:pk>/', UsersView.as_view()), path('', include(router.urls))]
