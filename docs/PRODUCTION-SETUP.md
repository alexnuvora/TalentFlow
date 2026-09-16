# TalentFlow production launch checklist

Complete every mandatory gate in `docs/UK-COMPLIANCE-AND-LAUNCH.md`; a successful software build is not legal or production approval.

## Database order
Run these in Supabase SQL Editor in this order:
1. `supabase/schema.sql`
2. `supabase/commercial_migration.sql`
3. `supabase/v3_migration.sql`
4. `supabase/v4_migration.sql`
5. `supabase/v5_acquisition.sql`
6. `supabase/v6_candidate_conversion.sql`
7. `supabase/v7_recruiter_os.sql`
8. `supabase/v8_production_compliance.sql`
9. `supabase/v9_least_privilege.sql`

Apply each migration once in order through a version-controlled staging workflow. Do not paste the full chain repeatedly into a live database; some enum and policy statements are intentionally one-time operations.

## Recruiter owner
Create an Auth user, then create a company and profile:

```sql
insert into public.companies(name) values ('Your Recruitment Company') returning id;
insert into public.profiles(id, company_id, full_name, role)
values ('AUTH_USER_UUID', 'COMPANY_UUID', 'Your Name', 'owner');
```

## Client portal user
1. Create the client in **Clients**.
2. Create an Auth user in Supabase Auth for the client's contact.
3. Link the Auth user to the client:

```sql
update public.profiles
set client_id='CLIENT_UUID', role='viewer', full_name='Client Contact'
where id='AUTH_USER_UUID';
```

A `viewer` profile with `client_id` is treated as a read-only client portal user. On sign-in the user is routed to `/client` automatically.

## Candidate portal
Candidate application submissions create a private bearer token that expires after 30 days. Set the Edge Function secret `PUBLIC_APP_URL` to the public Vite deployment URL. Recruiters can also create a fresh 30-day private link from **Candidates → Private link**.

Do not put candidate portal tokens in analytics events, logs or public URLs outside the candidate's private message.

## Email / SMS / WhatsApp
Deploy `supabase/functions/send-notification` and configure server-side secrets:

- `RESEND_API_KEY`
- `RESEND_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`

Only `owner` and `manager` profiles can invoke notification sending.

## AI screening
Deploy `ai-screen-candidate` and configure:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Keep screening criteria job-related and retain human review. Do not use protected or sensitive characteristics as screening criteria.

## Attribution
The public job page captures `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, landing path and referrer. Use URLs such as:

`/careers/self-employed-utility-consultant?utm_source=facebook&utm_medium=paid_social&utm_campaign=kes_agents`

Campaign data is stored in `application_events` and can later be joined to placement revenue for CAC/ROI reporting.

## Billing
The commercial ledger is provider-neutral and records contract rules, placement fees, VAT, invoice state, payment terms and guarantees. `billing_connections` is the integration registry for Stripe/Xero; implement OAuth/webhook credentials server-side before enabling live accounting synchronisation.

## V5 acquisition engine

Run `supabase/v5_acquisition.sql` after the earlier migrations. It adds campaigns, public campaign landing pages, referral links, event tracking, attribution and candidate nurture queueing.

Deploy the `track-campaign-event` Edge Function. It is intentionally public but only records events for active campaign slugs through a server-side validation function.

Deploy `process-automation-queue` and invoke it from a trusted scheduler every 5–10 minutes. Set a long random `AUTOMATION_CRON_SECRET` and send it in the `x-automation-secret` header; the processor fails closed when it is absent. Configure `RESEND_*` for email or `TWILIO_*` for SMS/WhatsApp before activating a sequence.

### Campaign workflow

1. Create a client and published job.
2. Go to **Acquisition → New campaign** and choose the client/job.
3. Set the campaign to **Active**.
4. Create referral links for Indeed, Meta, LinkedIn, recruiters, partners or individual referrers.
5. Share the generated `/campaign/<slug>?link=<link>` URL.
6. Applications retain `campaign_id` and UTM attribution.
7. Record the placement; campaign attribution is inferred from the candidate's latest submitted application unless manually selected.
8. Review cost/application, cost/placement, attributed revenue and ROI in Acquisition.

### Candidate nurture

An active `application_received` sequence automatically enrolls new applications. Each step is stored as JSON with `delay_hours`, `subject` and `body`. Supported placeholders are `{{first_name}}` and `{{job_title}}`. The queue processor sends due messages and retries transient failures up to three times.
