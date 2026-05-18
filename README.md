# AI Governance Evidence Matching App (Local)

This repository contains a local-first TypeScript architecture and starter implementation for:
- authenticated user access
- secure file upload (PDF, DOC, DOCX, XLS, XLSX)
- text extraction and chunking
- evidence-based matching against 4 OpenAI vector stores
- NIST AI RMF governance interpretation and reporting
- auditable traceability from input to retrieval evidence

## Quick start

### Backend
1. `cd backend`
2. `cp .env.example .env`
3. `npm install`
4. `npx prisma migrate dev --name init`
5. `npm run dev`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Notes
- API key is server-side only.
- Vector store IDs are configured in backend env.
- Results only use retrieved evidence; no-evidence paths return "No reliable match found.".
