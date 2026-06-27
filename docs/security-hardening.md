# Factra AI Security Hardening

## Implemented Controls

- API keys are backend-only. Do not create `VITE_*KEY`, `VITE_*SECRET`, or `VITE_*TOKEN` values.
- Helmet security headers are enabled on the Express backend.
- CORS is restricted to the configured frontend origin and localhost development origins.
- Rate limiting is enabled for auth, verification, report, and video routes.
- Request bodies are validated with Zod.
- Video/audio uploads are limited by MIME type and size.
- Sessions use high-entropy tokens stored in HTTP-only cookies.
- Session tokens are hashed before storage.
- Sessions expire after 7 days.
- Reports are private by default in the Supabase schema.
- Reports can be deleted by the owner.
- Stored reports are PII-masked for emails, phone numbers, Aadhaar-like IDs, and PIN codes.
- Gemini prompts treat claims/evidence as untrusted data.
- Evidence sent to Gemini is sanitized against prompt-injection phrases.
- Strong verdicts require strong evidence and citation references.
- Search snippets are no longer blindly trusted.

## Required Supabase Step

Run `supabase/schema.sql` in the Supabase SQL editor after deploying these changes.

The backend should use `SUPABASE_SERVICE_ROLE_KEY` only on the server. Do not expose it in frontend environment variables.

## Secret Rotation Process

Rotate keys immediately if a secret is pasted into chat, committed, logged, or shown in a browser:

1. Revoke the leaked key in the provider dashboard.
2. Generate a new key.
3. Update `.env.local` or production secret storage.
4. Restart the backend.
5. Check logs for failed old-key usage.

Rotate these keys regularly:

- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERPER_API_KEY`
- `NEWSAPI_KEY`
- `NEWSDATA_API_KEY`

## Dependency Scanning

Run these checks before deployment:

```bash
npm audit
```

For Python dependencies:

```bash
.venv\Scripts\python.exe -m pip list --outdated
.venv-whisper\Scripts\python.exe -m pip list --outdated
```

Enable Dependabot or GitHub security alerts if the project is hosted on GitHub.

