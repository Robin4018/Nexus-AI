import os
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from openai import OpenAI
from .models import Conversation, Message
from .serializers import ConversationSerializer, ConversationDetailSerializer, MessageSerializer


def get_ai_client():
    api_key = settings.GROQ_API_KEY
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
            {'error': 'AI service not configured. Please set the GROQ_API_KEY secret.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Save user message
    user_msg = Message.objects.create(conversation=convo, role='user', content=content)

    # Build full conversation history for context
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

    # Save AI response and update conversation timestamp
    assistant_msg = Message.objects.create(conversation=convo, role='assistant', content=ai_content)
    convo.save()  # triggers auto_now on updated_at

    return Response({
        'user_message': MessageSerializer(user_msg).data,
        'assistant_message': MessageSerializer(assistant_msg).data,
    }, status=status.HTTP_201_CREATED)
