alter table public.clients
  add column if not exists agency_engagement_signal boolean not null default false,
  add column if not exists agency_engagement_source_url text,
  add column if not exists agency_engagement_evidence text,
  add column if not exists agency_engagement_assessed_at timestamptz,
  add column if not exists agency_engagement_assessed_by uuid;

comment on column public.clients.agency_engagement_signal is
  'Public evidence that the business is open to recruitment-agency engagement. This is a lead-priority signal only and MUST NOT be treated as specific consent to marketing calls or used to override TPS/CTPS.';

comment on column public.clients.agency_engagement_source_url is
  'Exact public source URL supporting agency_engagement_signal.';

comment on column public.clients.agency_engagement_evidence is
  'Short factual excerpt/summary supporting agency openness. Not marketing-call consent.';

alter table public.clients
  drop constraint if exists clients_agency_engagement_evidence_required;

alter table public.clients
  add constraint clients_agency_engagement_evidence_required
  check (
    agency_engagement_signal = false
    or (
      agency_engagement_source_url is not null
      and length(btrim(agency_engagement_source_url)) > 0
      and agency_engagement_evidence is not null
      and length(btrim(agency_engagement_evidence)) > 0
      and agency_engagement_assessed_at is not null
    )
  );
