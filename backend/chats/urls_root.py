from django.urls import path
from . import views

urlpatterns = [
    path('', views.conversations_root, name='conversations-root'),
]
