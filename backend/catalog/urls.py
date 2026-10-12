from django.urls import path
from .views import Categories, Products, ProductDetail, CatalogConfig, ValidateBag
from .checkout import CheckoutView
urlpatterns = [path('checkout/', CheckoutView.as_view()), path('categories/', Categories.as_view()), path('products/', Products.as_view()), path('products/<slug:slug>/', ProductDetail.as_view()), path('config/', CatalogConfig.as_view()), path('bag/validate/', ValidateBag.as_view())]
