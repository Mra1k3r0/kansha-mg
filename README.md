# Kansha MySQL Gateway

MySQL database API gateway for [Kansha Notes](https://kansha-notes.vercel.app/).

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MySQL credentials and API key
npm run dev
```

## Endpoints

- `GET /api/users`, `POST`, `PUT`, `DELETE`
- `GET /api/notes`, `POST`, `PUT`, `DELETE`
- `GET /api/folders`, `POST`, `PUT`, `DELETE`
- `GET /api/raw/status` - DB status
- `GET /api/raw/health` - Health check (public)

## Auth

All endpoints require `X-API-Key` header (except `/` and `/api/raw/health`).
