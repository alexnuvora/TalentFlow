
-- Performance hardening for partner v2 foreign keys and RLS init plans.

create index if not exists client_recruitment_contacts_client_id_idx
  on public.client_recruitment_contacts(client_id);
create index if not exists client_recruitment_contacts_created_by_idx
  on public.client_recruitment_contacts(created_by);

create index if not exists partner_candidate_access_candidate_idx
  on public.partner_candidate_access_requests(candidate_id);
create index if not exists partner_candidate_access_company_idx
  on public.partner_candidate_access_requests(company_id);
create index if not exists partner_candidate_access_job_idx
  on public.partner_candidate_access_requests(job_id);
create index if not exists partner_candidate_access_reviewed_by_idx
  on public.partner_candidate_access_requests(reviewed_by);

create index if not exists partner_client_handover_company_idx
  on public.partner_client_handover_requests(company_id);
create index if not exists partner_client_handover_from_partner_idx
  on public.partner_client_handover_requests(from_partner);
create index if not exists partner_client_handover_to_partner_idx
  on public.partner_client_handover_requests(to_partner);
create index if not exists partner_client_handover_reviewed_by_idx
  on public.partner_client_handover_requests(reviewed_by);

create index if not exists partner_client_sequences_client_idx
  on public.partner_client_sequences(client_id);
create index if not exists partner_client_sequences_company_idx
  on public.partner_client_sequences(company_id);

create index if not exists partner_referral_links_job_idx
  on public.partner_referral_links(job_id);
create index if not exists partner_referral_links_partner_idx
  on public.partner_referral_links(partner_id);

create index if not exists partner_talent_pool_members_candidate_idx
  on public.partner_talent_pool_members(candidate_id);
create index if not exists partner_talent_pools_company_idx
  on public.partner_talent_pools(company_id);

drop policy if exists "partner sequences read" on public.partner_client_sequences;
create policy "partner sequences read" on public.partner_client_sequences
for select to authenticated
using(
  company_id=private.current_company_id()
  and (private.is_manager() or partner_id=(select auth.uid()))
);

drop policy if exists "partner sequences own write" on public.partner_client_sequences;
create policy "partner sequences own write" on public.partner_client_sequences
for update to authenticated
using(
  company_id=private.current_company_id()
  and (private.is_manager() or partner_id=(select auth.uid()))
)
with check(
  company_id=private.current_company_id()
  and (private.is_manager() or partner_id=(select auth.uid()))
);

drop policy if exists "partner candidate access read" on public.partner_candidate_access_requests;
create policy "partner candidate access read" on public.partner_candidate_access_requests
for select to authenticated
using(
  company_id=private.current_company_id()
  and (private.is_manager() or partner_id=(select auth.uid()))
);

drop policy if exists "partner candidate access manager update" on public.partner_candidate_access_requests;
create policy "partner candidate access manager update" on public.partner_candidate_access_requests
for update to authenticated
using(company_id=private.current_company_id() and private.is_manager())
with check(company_id=private.current_company_id() and private.is_manager());

drop policy if exists "partner talent pools own" on public.partner_talent_pools;
create policy "partner talent pools own" on public.partner_talent_pools
for all to authenticated
using(
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      partner_id=(select auth.uid())
      and private.partner_is_active()
      and private.partner_can_source_candidates((select auth.uid()))
    )
  )
)
with check(
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      partner_id=(select auth.uid())
      and private.partner_is_active()
      and private.partner_can_source_candidates((select auth.uid()))
    )
  )
);

drop policy if exists "partner talent pool members own" on public.partner_talent_pool_members;
create policy "partner talent pool members own" on public.partner_talent_pool_members
for select to authenticated
using(
  exists(
    select 1
    from public.partner_talent_pools p
    where p.id=pool_id
      and p.company_id=private.current_company_id()
      and (
        private.is_manager()
        or p.partner_id=(select auth.uid())
      )
  )
);

drop policy if exists "partner referral own read" on public.partner_referral_links;
create policy "partner referral own read" on public.partner_referral_links
for select to authenticated
using(
  company_id=private.current_company_id()
  and (private.is_manager() or partner_id=(select auth.uid()))
);

drop policy if exists "partner client handover read" on public.partner_client_handover_requests;
create policy "partner client handover read" on public.partner_client_handover_requests
for select to authenticated
using(
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or from_partner=(select auth.uid())
    or to_partner=(select auth.uid())
  )
);
