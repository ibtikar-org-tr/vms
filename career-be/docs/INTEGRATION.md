# Career backend — integration notes

API prefix: `/ms/career`  
Worker: Cloudflare (Hono + D1 + R2). Local: `http://localhost:9690`.

## Auth (VMS SSO)

1. `POST /ms/career/api/auth/vms/exchange` with `{ code, redirectUri }`.
2. Proxies to VMS `/external-exchange` (no shared JWT secret).
3. Bearer tokens verified via VMS JWKS.

Config:

- `VMS_API_BASE` and/or `MEMBERSHIP_MS_SERVICE` (service binding preferred in VMS Cloudflare account)
- `VMS_INTERNAL_SECRET` — **not** for SSO exchange; only for VMS internal partner-profile endpoints if used
- `MEMBERS_DB` / `VMS_DB` — shared D1 bindings
- `CAREER_BUCKET` — R2 for CV files

## Important when modifying Career BE

- Keep `/ms/career` prefix.
- Verify access tokens with JWKS (`iss=ibtikar-vms`, `type=access`); do not require `JWT_SECRET`.
- Exchange must send `redirectUri` matching the handoff callback URL.
- MVP is profiles / CV only; do not expose companies/jobs/applications unless product scope changes.
