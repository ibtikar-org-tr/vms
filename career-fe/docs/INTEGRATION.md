# Career frontend — integration notes

Vite + React. Local: `http://localhost:9692`.

## Env

- `VITE_API_TARGET` — Career API base **including** `/ms/career`  
  local: `http://localhost:9690/ms/career`
- VMS login / Integrations: Career URL is configured on VMS FE as `VITE_CAREER_URL`.

## SSO flow

Same pattern as Kitchen:

1. Handoff or login with `client=career` and callback `/auth/callback`.
2. Exchange `{ code, redirectUri }` through Career BE (`redirectUri` = current URL without `code`).
3. Store Bearer access token from Career BE.

VMS must allowlist this FE origin in `CORS_ALLOW_ORIGINS`.

## Important when modifying Career FE

- Keep callback contract (`code`, `next`) compatible with VMS handoff.
- Production `VITE_CAREER_URL` on VMS must not fall back to localhost.
