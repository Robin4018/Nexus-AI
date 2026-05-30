from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_conversations, name='conversation-list'),
    path('create', views.create_conversation, name='conversation-create'),
    path('<int:pk>', views.get_conversation, name='conversation-detail'),
    path('<int:pk>/update', views.update_conversation, name='conversation-update'),
    path('<int:pk>/delete', views.delete_conversation, name='conversation-delete'),
    path('<int:pk>/messages', views.send_message, name='message-send'),
]
