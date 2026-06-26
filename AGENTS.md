# Awaaz Developer Rules & Conventions

## Environment Variables and Architecture
- **No Hardcoded Secrets or Configurations**: Never hardcode Firebase configuration details, database project IDs, or backend keys in any file.
- **Environment Fallbacks**: Always read from environment variables first (e.g., `import.meta.env` for Vite client-side and `process.env` for server-side Node/Express code). Provide the pre-configured managed project variables *only* as a fallback to ensure out-of-the-box functioning in AI Studio while fully supporting the user's custom environment overrides.
- **Client Prefixes**: All client-accessible configuration variables must be prefixed with `VITE_` (e.g. `VITE_FIREBASE_API_KEY`) and declared in `.env.example`.
- **Backend Secrets**: Backend secrets (such as `FIREBASE_SERVICE_ACCOUNT_JSON` or private API keys) must remain server-side and never be exposed to the browser.
