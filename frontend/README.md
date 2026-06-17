# LegalGuide - Backend

This project provides a minimal backend for the LegalGuide static frontend.

Features:
- Serves static files (the project root) using Express
- **SQLite** persistence (`legalguide.db`, configurable via `SQLITE_PATH`) for users, bookings, reviews, AI chats, admin actions, and contact form messages
- One-time import from `legalguide-data.json` on first run if the DB is empty
- /api/chat — proxies to the Python RAG API (`rag_api.py` on port 8000)
- /api/contact — saves contact messages to the database
- /api/book — stores booking requests in the database
- /api/health — simple health check

Quick start

1. Install dependencies:

```bash
npm install
```

2. Set up the Python RAG backend (one time):

```powershell
cd ..\Final_grad_project
.\setup.ps1
copy .env.example .env
# Edit .env and set GROQ_API_KEY=...
```

3. Start both servers (easiest):

```powershell
cd "test grad - Copy"
.\start-all.ps1
```

Or manually: run `Final_grad_project\start-rag.ps1` then `npm start` in this folder.

4. Open http://localhost:3000 in your browser.

Notes
- Contact and bookings are stored in memory and will be reset when the server restarts. Replace with a database for persistence.
- The AI chat requires the RAG API on port 8000 and a valid `GROQ_API_KEY`.

Auth and bookings
- The server provides `/api/signup` and `/api/login` which return a JWT token. The frontend stores this token in `localStorage` and uses it to access protected endpoints.
- `/api/book` requires an `Authorization: Bearer <token>` header; unauthenticated requests are rejected.
- Lawyers can accept or decline bookings via `/api/book/:id/accept` and `/api/book/:id/decline` (authenticated lawyer only).

Note: accounts and bookings are stored in-memory for this demo. Use a database for production.
