# Nexus Chat

An AI chat application similar to ChatGPT — users can sign up, log in, create multiple conversations, chat with an AI, and manage their chat history.

## Run & Operate

- **Frontend**: `pnpm --filter @workspace/chat-frontend run dev` (port assigned by workflow)
- **Backend (Django)**: `PYTHONPATH=/home/runner/workspace/backend DJANGO_SETTINGS_MODULE=chatapi.settings python /home/runner/workspace/backend/manage.py runserver 0.0.0.0:$PORT`
- **Migrations**: `cd backend && python manage.py makemigrations && python manage.py migrate`
- **Typecheck frontend**: `pnpm --filter @workspace/chat-frontend run typecheck`
- **Codegen**: `pnpm --filter @workspace/api-spec run codegen`
- Required secrets: `GROQ_API_KEY` — free from https://console.groq.com
- Optional: `DATABASE_URL` — if not set, falls back to SQLite

## Stack

- **Frontend**: React + Vite + TypeScript, TanStack Query, Wouter, shadcn/ui, Tailwind CSS
- **Backend**: Python 3.11, Django 5, Django REST Framework, SimpleJWT
- **Database**: PostgreSQL (Replit-managed) or SQLite fallback
- **AI**: Groq API (free) — llama-3.3-70b-versatile via OpenAI-compatible SDK
- **Auth**: JWT (access + refresh tokens), bcrypt password hashing via Django

## Where things live

- `backend/` — Django project root
  - `chatapi/` — project settings, URLs, WSGI
  - `users/` — custom User model, auth views (register, login, refresh, me)
  - `chats/` — Conversation + Message models, chat views
- `artifacts/chat-frontend/src/` — React frontend
  - `pages/login.tsx` — Login page
  - `pages/register.tsx` — Register page
  - `pages/chat.tsx` — Main chat UI (sidebar + conversation)
  - `App.tsx` — Router + JWT injection setup
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas

## Architecture decisions

- Django backend runs at `/api` path — the reverse proxy routes all `/api/*` requests to it.
- Frontend uses Orval-generated hooks from `@workspace/api-client-react` for all API calls.
- JWT tokens stored in `localStorage`; injected into every request via `setAuthTokenGetter`.
- Groq's API is OpenAI-compatible — uses the `openai` Python SDK pointed at `https://api.groq.com/openai/v1`.
- SQLite is used as a fallback when `DATABASE_URL` is not set (dev/GitHub hosting).

## Product

- User signup/login with JWT authentication and hashed passwords
- Create, rename, and delete chat conversations
- Full conversation history stored in database with per-user isolation
- AI responses from Groq (free Llama 3.3 70B model)
- Responsive ChatGPT-style UI: dark theme, sidebar with chat list, message bubbles

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `PYTHONPATH` must be set to `/home/runner/workspace/backend` for Django to find `chatapi.settings`
- The artifact run command uses a full inline shell command (not `cd backend`) because workflows run from repo root
- After any model change: `cd backend && python manage.py makemigrations && python manage.py migrate`
- OpenAPI spec body schemas must use entity-shaped names (not `CreateXBody`) to avoid Orval TS2308 collisions

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
