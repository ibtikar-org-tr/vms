# career-be

Ibtikar Career API (Hono + Cloudflare Workers + D1 + R2).

## MVP scope

CV / career profiles only:

- VMS SSO
- Inherited VMS profile (read-only)
- Work history, CV/file uploads, publish for browsing
- Manual hiring process outside the app

Companies, jobs, and applications are **not** exposed in this version (tables may still exist in D1 for a later phase).

## Local secrets

Do **not** put secrets in `wrangler.jsonc`. Copy the example and fill values that match VMS:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` is gitignored and loaded automatically by `wrangler dev`:

- `JWT_SECRET` — same as VMS `JWT_SECRET`
- `VMS_INTERNAL_SECRET` — same as VMS `INTERNAL_SECRET`

## Scripts

```bash
npm install
npm run db:migrate:local
npm run dev
```

API: `http://localhost:9690`
