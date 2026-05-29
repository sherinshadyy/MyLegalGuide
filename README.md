# MyLegalGuide_Grad2

AI-powered legal guidance platform that helps users understand their rights, identify legal issues, generate legal documents, and connect with verified lawyers through a simple and accessible interface.

## Project structure

| Folder | Description |
|--------|-------------|
| `frontend/` | Node.js + Express website (lawyers, booking, dashboards, AI chat UI) |
| `backend/` | Python RAG API and legal document retrieval |

## Quick start

### 1. Frontend (website + API)

```bash
cd frontend
npm install
copy .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000)

On first run, `legalguide-data.json` is created automatically for local accounts and bookings.

### 2. Backend (RAG / AI chat)

```bash
cd backend
copy .env.example .env
# Add GROQ_API_KEY to .env
pip install -r requirements.txt
python rag_api.py
```

Or use `backend\start-rag.ps1` / `frontend\start-all.ps1` on Windows.

## Features

- User, lawyer, and admin roles with JWT auth
- Lawyer directory with filters, full profile pages, and booking
- Lawyer public profile: phone, experience, location, consultation duration, meeting type
- Admin approval workflow for new lawyers
- AI legal assistant (requires RAG backend)

## License

Graduation project — see course requirements for usage.
