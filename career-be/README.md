# career-be

Ibtikar Career API (Hono + Cloudflare Workers + D1 + R2).

See [docs/INTEGRATION.md](./docs/INTEGRATION.md) for SSO, env, and integration rules.

## Local

```bash
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```

API base: `http://localhost:9690/ms/career`  
Health: `GET /ms/career/health`
