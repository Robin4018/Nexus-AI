from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('api/', include([
        path('healthz', health_check, name='health_check'),
        path('auth/', include('users.urls')),
        path('conversations', include('chats.urls_root')),
        path('conversations/', include('chats.urls_detail')),
    ])),
]
