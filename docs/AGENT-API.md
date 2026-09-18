# TalentFlow Agent API

Authenticated operational API for approved TalentFlow staff and AI clients.

Endpoint: Supabase Edge Function `talentflow-agent-api`.

Authentication uses a normal TalentFlow user JWT. The function resolves the user's `profiles.company_id` and role server-side. Callers cannot supply or override a tenant/company id.

Initial actions:
- `search_clients`
- `search_jobs`
- `search_candidates`
- `create_client` (owner/manager)
- `create_candidate`
- `create_application`
- `record_activity`

All database queries are constrained to the authenticated user's company. Mutations generate activity records where appropriate. Service-role credentials remain server-side only.

Example body:

```json
{"action":"search_clients","args":{"query":"Manchester"}}
```

This service is deliberately narrower than direct database access. Add new agent capabilities as explicit actions with tenant checks, role checks, validation and audit logging.
