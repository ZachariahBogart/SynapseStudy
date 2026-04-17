# Synapse Study

Synapse Study is a course-based study app that turns uploaded PDFs and PowerPoints into a tutor, flashcards, quizzes, and a guided learning path that adapts to student confidence.

## Stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Dramatiq, SQLite for local dev
- Ingestion: `pypdf` for PDFs, `python-pptx` for PowerPoints

## Project Layout

- `frontend/` contains the web app
- `backend/` contains the API, ingestion pipeline, and worker entrypoint
- `.tools/pnpm.exe` is a local pnpm helper used because this machine does not have a global Node install

## Local Development

### 1. Install backend dependencies

```powershell
cd C:\Users\rockl\Documents\Codex\2026-04-16-i-want-to-make-an-ai\backend
python -m venv ..\.venv
..\.venv\Scripts\python.exe -m pip install --upgrade pip
..\.venv\Scripts\python.exe -m pip install -e .[dev]
```

### 2. Install frontend dependencies

```powershell
cd C:\Users\rockl\Documents\Codex\2026-04-16-i-want-to-make-an-ai
.\.tools\pnpm.exe --dir frontend install
```

### 3. Run the API

```powershell
cd C:\Users\rockl\Documents\Codex\2026-04-16-i-want-to-make-an-ai\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### 4. Run the web app

```powershell
cd C:\Users\rockl\Documents\Codex\2026-04-16-i-want-to-make-an-ai
.\.tools\pnpm.exe --dir frontend dev
```

The backend defaults to `http://localhost:8000` and the frontend defaults to `http://localhost:5173`.

## Notes

- The current implementation uses a lightweight local profile header instead of a full Supabase auth flow so the MVP runs immediately in local development.
- The data model already supports future asset types such as `image`, `audio`, and `video`.
- Dramatiq workers are wired in, but local uploads fall back to FastAPI background tasks unless Redis is configured.
