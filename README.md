# Nexus Chat

A full-stack AI chat application — a polished ChatGPT-style workspace built with Django and React.

![Nexus Chat](https://img.shields.io/badge/AI-Groq%20Llama%203.3%2070B-orange) ![Backend](https://img.shields.io/badge/Backend-Django%205-green) ![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)

## Features

- **JWT Authentication** — Register and log in with email + password. Tokens stored securely, auto-injected into all API requests.
- **Multiple Conversations** — Create, rename, and delete chat threads. Full history stored per user.
- **AI Responses** — Powered by Groq's free Llama 3.3 70B model (OpenAI-compatible API).
- **ChatGPT-style UI** — Dark workspace aesthetic with a sidebar, message bubbles, and smooth UX.
- **Per-user isolation** — Each user only sees their own conversations and messages.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript, TanStack Query, Wouter, shadcn/ui, Tailwind CSS |
| Backend | Python 3.11, Django 5, Django REST Framework, SimpleJWT |
| Database | PostgreSQL (or SQLite fallback) |
| AI | Groq API — `llama-3.3-70b-versatile` |

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm
- A free [Groq API key](https://console.groq.com)

### 1. Clone the repo

```bash
git clone https://github.com/Robin4018/Nexus-AI.git
cd Nexus-AI
```

### 2. Set environment variables

Create a `.env` file or export these in your shell:

```bash
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_django_secret_key_here   # any random string
DATABASE_URL=postgresql://...            # optional — falls back to SQLite
```

### 3. Install backend dependencies

```bash
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers openai psycopg2-binary whitenoise gunicorn
```

### 4. Run Django migrations

```bash
PYTHONPATH=/path/to/Nexus-AI/backend DJANGO_SETTINGS_MODULE=chatapi.settings python backend/manage.py migrate
```

### 5. Install frontend dependencies

```bash
pnpm install
```

### 6. Start the backend

```bash
PYTHONPATH=/path/to/Nexus-AI/backend DJANGO_SETTINGS_MODULE=chatapi.settings python backend/manage.py runserver 0.0.0.0:8080
```

### 7. Start the frontend

```bash
pnpm --filter @workspace/chat-frontend run dev
```

Visit `http://localhost:5173` — register an account and start chatting.

## Project Structure

```
├── backend/
│   ├── chatapi/          # Django settings, URLs, WSGI
│   ├── users/            # Custom User model, JWT auth views
│   └── chats/            # Conversation + Message models, AI views
├── artifacts/
│   └── chat-frontend/    # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── login.tsx
│           │   ├── register.tsx
│           │   └── chat.tsx
│           └── App.tsx
├── lib/
│   ├── api-spec/         # OpenAPI contract (source of truth)
│   ├── api-client-react/ # Generated TanStack Query hooks
│   └── api-zod/          # Generated Zod schemas
└── pnpm-workspace.yaml
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/conversations` | List all conversations |
| POST | `/api/conversations` | Create a conversation |
| GET | `/api/conversations/:id` | Get conversation + messages |
| PATCH | `/api/conversations/:id` | Rename a conversation |
| DELETE | `/api/conversations/:id` | Delete a conversation |
| POST | `/api/conversations/:id/messages` | Send a message, get AI reply |

## License

MIT
