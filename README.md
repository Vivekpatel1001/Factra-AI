# Factra AI

Factra AI is a fact-checking web application. It lets users verify claims from text, links, images, and videos, then returns a clear verdict with evidence, trust score, explanation, and recommendations.

The project is built with a React frontend and a Node/Express backend. The backend uses AI, OCR, search providers, trusted-source retrieval, and optional transcription tools to check claims.

## What The Website Does

Users can submit:

- Text claims
- Article or web links
- Images that contain text
- Video files
- Video links

Factra AI then:

1. Reads or extracts the claim.
2. Splits the content into smaller checkable claims.
3. Searches for trusted evidence.
4. Uses Gemini and local rules to analyze the claim.
5. Calculates a trust score.
6. Shows a verdict, evidence, explanation, and recommendation.

Possible verdicts:

- `TRUE`
- `FALSE`
- `MISLEADING`
- `UNVERIFIED`

## Important Feature: Majority Verdict Logic

For images, posters, or videos, one input can contain many claims. Some claims can be true while others are false.

Factra AI now checks each claim separately and decides the overall result by majority.

Example:

```txt
Claim 1: FALSE
Claim 2: TRUE
Claim 3: TRUE

Overall verdict: TRUE
```

The false claim is still shown separately in the report, but it does not make the full report false if most claims are true.

Tie or mixed unclear results become `MISLEADING`.

## Project Structure

```txt
Factra-AI/
├── backend/
│   ├── server.js
│   ├── services/
│   │   ├── verification.js
│   │   ├── supabase.js
│   │   └── faster_whisper_transcribe.py
│   ├── rag/
│   │   ├── rag_search.py
│   │   ├── trusted_sources.json
│   │   └── index/
│   └── app/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── pages/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   └── lib/
├── public/
├── docs/
├── supabase/
├── dist/
├── .env.local
├── package.json
└── vite.config.js
```

## Main Files Explained

### `src/App.jsx`

Controls the main frontend routes:

- `/`
- `/verify`
- `/how-it-works`
- `/about`
- `/login`
- `/signup`
- `/saved`

### `src/pages/VerifyPage.jsx`

The main verification page. It shows the input form, loading state, errors, and final result.

### `src/components/InputTabs.jsx`

Handles all user input types:

- Text input
- Link input
- Image upload and OCR
- Video upload
- Video link extraction
- Transcript editing

### `src/components/ResultCard.jsx`

Displays the final fact-check result:

- Verdict
- Trust score
- Explanation
- Evidence cards
- Extracted claims
- Timeline for videos
- Download/share buttons

### `src/context/AppContext.jsx`

Stores global app state:

- Current language
- Large font mode
- Logged-in user
- Auth loading state
- Logout function
- Translation helper

### `src/lib/api.js`

Frontend API helper. It sends requests to the backend, stores auth token, and handles unauthorized responses.

### `src/lib/translations.js`

Contains translation text for the app UI.

### `backend/server.js`

Main backend server. It defines all API routes, authentication, validation, rate limits, and report saving.

### `backend/services/verification.js`

The main fact-checking brain of the project. It handles:

- Claim cleaning
- Claim extraction
- Evidence search
- Gemini analysis
- Fraud guardrails
- Trust score calculation
- Majority verdict aggregation
- Translation/localization
- Image OCR with Gemini
- Video extraction/transcription helpers

### `.env.local`

Local environment file. It stores API keys and configuration values. Do not commit real secrets publicly.

## Frontend Pages

### Landing Page

Introduces the app and sends users to verification.

File:

```txt
src/pages/LandingPage.jsx
```

### Verify Page

The main page where users check claims.

File:

```txt
src/pages/VerifyPage.jsx
```

### Login And Signup Pages

Allow users to create accounts and log in.

File:

```txt
src/pages/AuthPage.jsx
```

### Saved Checks Page

Shows reports saved by logged-in users.

File:

```txt
src/pages/SavedChecksPage.jsx
```

### About And How It Works Pages

Explain the product and process.

Files:

```txt
src/pages/AboutPage.jsx
src/pages/HowItWorksPage.jsx
```

## Backend API Routes

### Health Check

```txt
GET /api/health
```

Checks whether the backend is running.

### Verify Claim

```txt
POST /api/verify
```

Main fact-check endpoint.

Example request:

```json
{
  "type": "text",
  "language": "en",
  "content": {
    "text": "Government is giving free money to everyone."
  }
}
```

### Extract Image Text

```txt
POST /api/image/extract
```

Uses Gemini Vision to read text from an uploaded image.

### Extract Video Content

```txt
POST /api/video/extract
```

Extracts visible text and speech from uploaded video/audio.

### Extract Video Link Context

```txt
POST /api/video/link-extract
```

Extracts useful context from public video links.

### Authentication

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/me
```

### Reports

```txt
GET    /api/reports
DELETE /api/reports/:id
```

Used for saved fact-check reports.

## Verification Flow

Simple flow:

```txt
User input
→ frontend prepares data
→ backend receives request
→ claim is cleaned
→ claim is split into smaller claims
→ each claim is checked separately
→ evidence is collected
→ Gemini analyzes evidence
→ fraud/scam rules are applied
→ trust score is calculated
→ final verdict is decided by majority
→ report is returned to frontend
```

## Image Verification Flow

When a user uploads an image:

1. Frontend prepares the image.
2. OCR reads the visible text.
3. Gemini Vision can extract text more accurately.
4. Extracted text is sent to `/api/verify`.
5. Backend splits the text into multiple claims.
6. Each claim is checked separately.
7. Overall verdict is based on majority.

Example:

```txt
Image text:
PM Awas Yojana this year 57 lakh people got houses.
PM Awas Yojana is Housing for All.
PMAY-Gramin is a scheme.

Result:
Claim 1: FALSE
Claim 2: TRUE
Claim 3: TRUE
Overall: TRUE
```

## Video Verification Flow

When a user uploads a video:

1. The video is converted to base64.
2. Backend tries Gemini video extraction.
3. If needed, Whisper/faster-whisper can transcribe speech.
4. Transcript is split into time-based claims.
5. Each claim is checked separately.
6. The result can show a video timeline.

## Evidence Sources

The backend can use multiple sources:

- Official government sources
- PIB/fact-check sources
- Trusted news sources
- Serper search results
- News API providers
- Local RAG/vector index
- Gemini model reasoning

Trusted-source examples include:

- `gov.in`
- `nic.in`
- `pib.gov.in`
- `factcheck.pib.gov.in`
- `rbi.org.in`
- `eci.gov.in`
- `who.int`
- `reuters.com`
- `apnews.com`

## Environment Variables

The app uses `.env.local` for local configuration.

Important variables:

```txt
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SERPER_API_KEY=
NEWSAPI_KEY=
NEWSDATA_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://127.0.0.1:5173
VITE_API_BASE_URL=http://127.0.0.1:4000
```

Do not share real API keys in public repositories.

## Install Dependencies

```powershell
npm install
```

## Run The Project

Start backend:

```powershell
npm run dev:backend
```

Start frontend:

```powershell
npm run dev
```

Frontend URL:

```txt
http://127.0.0.1:5173
```

Backend URL:

```txt
http://127.0.0.1:4000
```

## Build The Website

```powershell
npm run build
```

The production build is created in:

```txt
dist/
```

## Preview Production Build

```powershell
npm run preview
```

## Useful Commands

Check backend health:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:4000/api/health -UseBasicParsing
```

Run frontend build:

```powershell
npm run build
```

Start backend:

```powershell
npm run dev:backend
```

Start frontend:

```powershell
npm run dev
```

## Authentication And Saved Reports

Users can create an account, log in, and save their fact-check reports.

Supabase is used when configured. During local development, the backend also has a local fallback, so the app can still work if Supabase is unavailable.

## Trust Score

The trust score is calculated from:

- Evidence quality
- Recency
- Source reliability
- Claim clarity
- Confidence
- Overall verdict

A high score means the result is supported by stronger evidence.

## Languages

The app supports multiple languages through translation files and Gemini localization.

Main language-related files:

```txt
src/lib/translations.js
src/lib/localizeReport.js
src/hooks/useLocalizedReport.js
```

## Security Notes

The backend includes:

- Request validation with Zod
- Rate limiting
- CORS restrictions
- Helmet security middleware
- HttpOnly session cookies
- PII masking before saving reports

Important: keep API keys in `.env.local` and do not expose backend-only secrets in frontend variables.

## Simple Explanation For Beginners

Think of Factra AI like this:

```txt
Frontend = what the user sees
Backend = the brain that checks truth
Gemini = AI helper
Search APIs = evidence finder
Supabase = account and saved reports storage
```

When a user uploads something, the frontend sends it to the backend. The backend reads the content, finds claims, searches for proof, asks AI to reason over the evidence, then sends a result back to the frontend.

## Current Status

The project currently supports:

- Text checking
- Link checking
- Image OCR and checking
- Video upload checking
- Video link checking
- Multi-claim majority verdict logic
- Login/signup
- Saved reports
- Download/share reports
- Multi-language UI/report support

## Main Development Focus

If you want to improve the project further, the most important areas are:

1. Better claim extraction from complex posters.
2. More trusted Indian government sources.
3. Better UI for showing partially true/partially false results.
4. Faster RAG/search response time.
5. More tests for verdict aggregation.
6. Safer production deployment configuration.
