from django.urls import path
from . import views

urlpatterns = [
    path('<int:pk>', views.conversation_detail, name='conversation-detail'),
    path('<int:pk>/messages', views.send_message, name='message-send'),
]
