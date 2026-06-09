import json
import os
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from openai import OpenAI
from .models import Conversation, Message
from .serializers import ConversationSerializer, ConversationDetailSerializer, MessageSerializer


def get_ai_client():
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None
    return OpenAI(
        base_url=settings.AI_BASE_URL,
        api_key=api_key,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversations_root(request):
    if request.method == 'GET':
        convos = Conversation.objects.filter(user=request.user)
        return Response(ConversationSerializer(convos, many=True).data)
    title = request.data.get('title', 'New Chat')
    convo = Conversation.objects.create(user=request.user, title=title)
    return Response(ConversationSerializer(convo).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def conversation_detail(request, pk):
    try:
        convo = Conversation.objects.get(pk=pk, user=request.user)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ConversationDetailSerializer(convo).data)

    if request.method == 'PATCH':
        title = request.data.get('title')
        if title is not None:
            convo.title = title.strip() or 'New Chat'
            convo.save()
        return Response(ConversationSerializer(convo).data)

    # DELETE
    convo.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, pk):
    try:
        convo = Conversation.objects.get(pk=pk, user=request.user)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Message content is required.'}, status=status.HTTP_400_BAD_REQUEST)

    client = get_ai_client()
    if not client:
        return Response(
            {'error': 'AI service not configured. Please set the OPENAI_API_KEY secret.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    user_msg = Message.objects.create(conversation=convo, role='user', content=content)

    history = Message.objects.filter(conversation=convo).order_by('created_at')
    messages = [{'role': m.role, 'content': m.content} for m in history]

    try:
        completion = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=messages,
            max_tokens=8192,
        )
        ai_content = completion.choices[0].message.content or ''
    except Exception as exc:
        user_msg.delete()
        return Response(
            {'error': f'AI error: {str(exc)}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    assistant_msg = Message.objects.create(conversation=convo, role='assistant', content=ai_content)
    _maybe_auto_title(client, convo, content)
    convo.save()

    return Response({
        'user_message': MessageSerializer(user_msg).data,
        'assistant_message': MessageSerializer(assistant_msg).data,
    }, status=status.HTTP_201_CREATED)


def _maybe_auto_title(client, convo, first_content):
    is_first_message = Message.objects.filter(conversation=convo).count() == 2
    default_titles = {'New Chat', 'New Conversation'}
    if not (is_first_message and convo.title in default_titles):
        return
    try:
        title_completion = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'Generate a short, descriptive title (3–6 words) for a chat conversation '
                        'based on the user\'s first message. Reply with only the title — no quotes, '
                        'no punctuation at the end, no explanation.'
                    ),
                },
                {'role': 'user', 'content': first_content},
            ],
            max_tokens=20,
        )
        new_title = title_completion.choices[0].message.content.strip().strip('"\'')
        if new_title:
            convo.title = new_title
    except Exception:
        pass


def _stream_generator(client, convo, content, user_msg):
    """SSE generator: yields token chunks, saves to DB, auto-titles on completion."""
    history = Message.objects.filter(conversation=convo).order_by('created_at')
    messages_for_ai = [{'role': m.role, 'content': m.content} for m in history]

    full_response = ""
    try:
        stream = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=messages_for_ai,
            max_tokens=8192,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_response += delta
                yield f"data: {json.dumps({'type': 'chunk', 'content': delta})}\n\n"
    except Exception as exc:
        user_msg.delete()
        yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
        return

    assistant_msg = Message.objects.create(conversation=convo, role='assistant', content=full_response)
    _maybe_auto_title(client, convo, content)
    convo.save()

    yield f"data: {json.dumps({'type': 'done', 'conversation_title': convo.title})}\n\n"


@csrf_exempt
def stream_message(request, pk):
    """POST /api/conversations/:pk/stream — streams AI response as SSE."""
    if request.method != 'POST':
        from django.http import HttpResponseNotAllowed
        return HttpResponseNotAllowed(['POST'])

    # Manual JWT auth (DRF decorators don't compose cleanly with StreamingHttpResponse)
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework.exceptions import AuthenticationFailed
    jwt_auth = JWTAuthentication()
    try:
        result = jwt_auth.authenticate(request)
        if result is None:
            return _sse_error(401, 'Authentication required.')
        user, _ = result
    except Exception:
        return _sse_error(401, 'Invalid or expired token.')

    try:
        convo = Conversation.objects.get(pk=pk, user=user)
    except Conversation.DoesNotExist:
        return _sse_error(404, 'Conversation not found.')

    import json as _json
    try:
        body = _json.loads(request.body)
        content = body.get('content', '').strip()
    except Exception:
        content = ''

    if not content:
        return _sse_error(400, 'Message content is required.')

    client = get_ai_client()
    if not client:
        return _sse_error(503, 'AI service not configured.')

    user_msg = Message.objects.create(conversation=convo, role='user', content=content)

    response = StreamingHttpResponse(
        _stream_generator(client, convo, content, user_msg),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response


def _sse_error(http_status, message):
    from django.http import HttpResponse
    data = json.dumps({'type': 'error', 'error': message})
    return HttpResponse(f"data: {data}\n\n", status=http_status, content_type='text/event-stream')
