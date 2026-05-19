# NIST AI RMF Advisor

A local-first AI governance assessment web app that matches user-provided AI system descriptions and uploaded documents against OpenAI vector stores, then flags matching evidence and recommendations using the NIST AI Risk Management Framework functions: Govern, Map, Measure, and Manage.

## What this package includes

- Landing page
- Sign up and sign in pages
- Logged-in dashboard
- Assessment history page
- New assessment page with text input and multiple file upload
- Admin-only user management page
- Backend API with authentication, users, assessments, document extraction, vector-store matching, and local JSON persistence

## Default local login

After starting the backend, a default admin account is available:

```text
Email: admin@example.com
Password: password
```

Change or remove this account before production use.

## OpenAI API key setup

Copy the backend environment example:

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and replace:

```env
OPENAI_API_KEY="sk-your-openai-api-key-here"
```

The OpenAI API key is used only by the backend. Do not put the key in frontend files.

The four vector stores are already configured in `.env.example`:

```env
VECTOR_STORE_IDS="vs_6a0b0b741c38819190b8bc51a9dee79a,vs_6a0b0b5db5e48191816f28821ecd4b6f,vs_6a0b0b3ff85c8191bd8ef06323335a79,vs_6a0b06d3faf4819183127288049ef83c"
```

## Run locally in Antigravity

Open two terminals.

### Terminal 1: Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at:

```text
http://localhost:4000
```

### Terminal 2: Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## Supported uploads

The upload control accepts any file format. Text extraction works best for:

- PDF
- DOCX
- XLS / XLSX
- CSV
- TXT
- JSON
- XML
- HTML
- Markdown
- Log files

Unsupported binary files are accepted but marked as `NOT_EXTRACTABLE`, with a recommendation to convert the file into a text-readable format.

## Assessment statuses

Each extracted point is compared against the configured vector stores.

- `MATCHING`: identical or near-identical wording found in vector-store evidence.
- `POSSIBLE_MATCH_NOT_IDENTICAL`: related evidence found, but wording is not identical.
- `NOT_MATCHED`: no reliable identical evidence found; recommendation is shown.
- `NOT_EXTRACTABLE`: file uploaded but readable text could not be extracted.

## Production hardening checklist

This package is designed for local development. Before production deployment, add:

- Strong password policy
- Email verification
- HTTPS-only cookies
- Server-side rate limiting
- Malware scanning for uploaded files
- Role-based access review
- Database persistence instead of local JSON
- Secret management
- Audit-log retention policy
- Legal/privacy review for uploaded documents
