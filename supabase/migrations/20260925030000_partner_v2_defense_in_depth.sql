
-- Defense-in-depth: enforce specialism boundaries at RLS/trigger level, not only UI.

drop policy if exists "candidates authorised select" on public.candidates;
create policy "candidates authorised select" on public.candidates
for select to authenticated
using(
 public.candidate_processing_allowed(company_id)
 and company_id=private.current_company_id()
 and (
   private.has_candidate_data_access()
   or (
     private.partner_is_active()
     and private.partner_can_source_candidates(auth.uid())
     and exists(
       select 1 from public.partner_assignments a
       where a.company_id=candidates.company_id
         and a.partner_id=auth.uid()
         and a.candidate_id=candidates.id
         and a.completed_at is null
     )
   )
 )
);

drop policy if exists "partner candidate pipeline insert" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline insert" on public.partner_candidate_pipeline
for insert to authenticated
with check(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_source_candidates(auth.uid())
   )
 )
);

drop policy if exists "partner candidate pipeline select" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline select" on public.partner_candidate_pipeline
for select to authenticated
using(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_source_candidates(auth.uid())
   )
 )
);

drop policy if exists "partner candidate pipeline update" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline update" on public.partner_candidate_pipeline
for update to authenticated
using(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_source_candidates(auth.uid())
   )
 )
)
with check(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_source_candidates(auth.uid())
   )
 )
);

create or replace function public.enforce_partner_candidate_pipeline()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  new.updated_at := now();

  if v_manager then
    if tg_op='UPDATE' and new.manager_status is distinct from old.manager_status then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(auth.uid(),new.reviewed_by);
    end if;
    return new;
  end if;

  if not private.partner_is_active() then
    raise exception 'Active partner access required';
  end if;
  if not private.partner_can_source_candidates(auth.uid()) then
    raise exception 'Candidate sourcing is not enabled for this partner profile';
  end if;
  if not public.candidate_processing_allowed(private.current_company_id()) then
    raise exception 'Candidate processing is not active';
  end if;

  if tg_op='INSERT' then
    new.company_id := private.current_company_id();
    new.partner_id := auth.uid();
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
    new.manager_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then
      raise exception 'You may only update your own candidate pipeline';
    end if;
    new.company_id := old.company_id;
    new.partner_id := old.partner_id;
    new.candidate_id := old.candidate_id;
    new.job_id := old.job_id;
    new.manager_notes := old.manager_notes;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    if old.manager_status in ('approved','declined') then
      raise exception 'This recommendation has been reviewed by Vorlen and is locked';
    end if;
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
  end if;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.candidate_id=new.candidate_id and a.completed_at is null
  ) then raise exception 'Candidate is not assigned to your partner portfolio'; end if;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.job_id=new.job_id and a.completed_at is null
  ) then raise exception 'Vacancy is not assigned to your partner portfolio'; end if;

  if new.stage='recommended' and not exists(
    select 1 from public.candidates c
    where c.id=new.candidate_id and c.company_id=new.company_id
      and c.work_seeker_terms_agreed_at is not null
      and nullif(btrim(c.work_seeker_terms_evidence),'') is not null
  ) then
    raise exception 'Candidate work-seeker terms evidence is required before recommendation';
  end if;

  return new;
end
$$;

drop policy if exists "partner prospects update" on public.partner_prospects;
create policy "partner prospects update" on public.partner_prospects
for update to authenticated
using(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_prospect(auth.uid())
  )
 )
)
with check(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_prospect(auth.uid())
  )
 )
);

drop policy if exists "partner activity assigned client select" on public.partner_client_activity;
create policy "partner activity assigned client select" on public.partner_client_activity
for select to authenticated
using(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_develop_clients(auth.uid())
    and exists(
      select 1 from public.partner_assignments a
      where a.company_id=partner_client_activity.company_id
        and a.partner_id=auth.uid()
        and a.client_id=partner_client_activity.client_id
        and a.completed_at is null
    )
  )
 )
);

drop policy if exists "partner activity assigned client insert" on public.partner_client_activity;
create policy "partner activity assigned client insert" on public.partner_client_activity
for insert to authenticated
with check(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_develop_clients(auth.uid())
    and exists(
      select 1 from public.partner_assignments a
      where a.company_id=partner_client_activity.company_id
        and a.partner_id=auth.uid()
        and a.client_id=partner_client_activity.client_id
        and a.completed_at is null
    )
  )
 )
);

drop policy if exists "partner activity assigned client update" on public.partner_client_activity;
create policy "partner activity assigned client update" on public.partner_client_activity
for update to authenticated
using(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_develop_clients(auth.uid())
    and exists(
      select 1 from public.partner_assignments a
      where a.company_id=partner_client_activity.company_id
        and a.partner_id=auth.uid()
        and a.client_id=partner_client_activity.client_id
        and a.completed_at is null
    )
  )
 )
)
with check(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    partner_id=auth.uid()
    and private.partner_is_active()
    and private.partner_can_develop_clients(auth.uid())
    and exists(
      select 1 from public.partner_assignments a
      where a.company_id=partner_client_activity.company_id
        and a.partner_id=auth.uid()
        and a.client_id=partner_client_activity.client_id
        and a.completed_at is null
    )
  )
 )
);

drop policy if exists "partner notes assigned client read" on public.partner_client_notes;
create policy "partner notes assigned client read" on public.partner_client_notes
for select to authenticated
using(
 company_id=private.current_company_id()
 and (
  private.is_manager()
  or (
    private.partner_is_active()
    and private.partner_can_develop_clients(auth.uid())
    and exists(
      select 1 from public.partner_assignments a
      where a.company_id=partner_client_notes.company_id
        and a.partner_id=auth.uid()
        and a.client_id=partner_client_notes.client_id
        and a.completed_at is null
    )
  )
 )
);

drop policy if exists "partner notes insert assigned client" on public.partner_client_notes;
create policy "partner notes insert assigned client" on public.partner_client_notes
for insert to authenticated
with check(
 company_id=private.current_company_id()
 and partner_id=auth.uid()
 and private.partner_is_active()
 and private.partner_can_develop_clients(auth.uid())
 and exists(
   select 1 from public.partner_assignments a
   where a.company_id=partner_client_notes.company_id
     and a.partner_id=auth.uid()
     and a.client_id=partner_client_notes.client_id
     and a.completed_at is null
 )
);

drop policy if exists "partner talent pools own" on public.partner_talent_pools;
create policy "partner talent pools own" on public.partner_talent_pools
for all to authenticated
using(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (partner_id=auth.uid() and private.partner_is_active() and private.partner_can_source_candidates(auth.uid()))
 )
)
with check(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (partner_id=auth.uid() and private.partner_is_active() and private.partner_can_source_candidates(auth.uid()))
 )
);

create or replace function public.partner_client_workspace(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 v_client public.clients%rowtype;
 v_hash text;
 v_terms_authorised boolean:=false;
begin
 if not private.partner_is_active(auth.uid())
    or not private.partner_can_develop_clients(auth.uid())
    or not private.partner_has_assigned_client(p_client,auth.uid()) then
   raise exception 'Assigned client-development access required';
 end if;

 select * into v_client from public.clients where id=p_client and company_id=v_company;
 if not found then raise exception 'Client not found'; end if;

 v_hash:=private.client_commercial_hash(p_client);
 v_terms_authorised:=v_client.partner_terms_send_authorized_at is not null
   and v_client.partner_terms_send_authorized_hash=v_hash
   and v_client.terms_accepted_at is null;

 return jsonb_build_object(
  'client',jsonb_build_object(
    'id',v_client.id,'company_name',v_client.company_name,'contact_name',v_client.contact_name,
    'email',v_client.email,'phone',v_client.phone,'website',v_client.website,'status',v_client.status,
    'business_nature',v_client.business_nature
  ),
  'capabilities',jsonb_build_object(
    'can_prospect',private.partner_can_prospect(auth.uid()),
    'can_close',private.partner_can_close_clients(auth.uid()),
    'can_source',private.partner_can_source_candidates(auth.uid())
  ),
  'commercial',jsonb_build_object(
    'terms_accepted',v_client.terms_accepted_at is not null,
    'terms_accepted_at',v_client.terms_accepted_at,
    'partner_send_authorised',v_terms_authorised,
    'fee_percent',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.recruitment_fee_percent else null end,
    'payment_terms_days',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.payment_terms_days else null end,
    'rebate_terms',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.rebate_terms else null end,
    'latest_document',(
      select jsonb_build_object('status',d.status,'sent_at',d.sent_at,'viewed_at',d.viewed_at,'accepted_at',d.accepted_at,'version',d.version)
      from public.client_terms_documents d
      where d.client_id=p_client and d.company_id=v_company
      order by d.created_at desc limit 1
    ),
    'contract_status',(
      select cc.status::text from public.client_contracts cc
      where cc.client_id=p_client and cc.company_id=v_company
      order by cc.created_at desc limit 1
    )
  ),
  'contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'role_title',x.role_title,'email',x.email,'phone',x.phone,
      'recruitment_authority',x.recruitment_authority,'vacancy_contact_confirmed',x.vacancy_contact_confirmed,
      'is_primary',x.is_primary,'last_confirmed_at',x.last_confirmed_at
    ) order by x.is_primary desc,x.last_confirmed_at desc)
    from public.client_recruitment_contacts x
    where x.client_id=p_client and x.company_id=v_company
  ),'[]'::jsonb),
  'jobs',coalesce((
    select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'location',j.location,'created_at',j.created_at) order by j.created_at desc)
    from public.jobs j where j.client_id=p_client and j.company_id=v_company
  ),'[]'::jsonb),
  'handoffs',coalesce((
    select jsonb_agg(jsonb_build_object('id',h.id,'vacancy_title',h.vacancy_title,'status',h.status,'manager_notes',h.manager_notes,'updated_at',h.updated_at) order by h.updated_at desc)
    from public.partner_commercial_handoffs h
    where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()
  ),'[]'::jsonb),
  'timeline',coalesce((
    select jsonb_agg(e order by (e->>'at')::timestamptz desc)
    from (
      select jsonb_build_object('type','partner_note','at',n.created_at,'title','Partner note','detail',n.note) e
      from public.partner_client_notes n
      where n.client_id=p_client and n.company_id=v_company and n.partner_id=auth.uid()
      union all
      select jsonb_build_object('type','terms','at',coalesce(d.accepted_at,d.viewed_at,d.sent_at,d.created_at),'title','Terms of Business · '||d.status,'detail',d.version)
      from public.client_terms_documents d where d.client_id=p_client and d.company_id=v_company
      union all
      select jsonb_build_object('type','vacancy','at',j.created_at,'title','Vacancy · '||j.title,'detail',j.status::text)
      from public.jobs j where j.client_id=p_client and j.company_id=v_company
      union all
      select jsonb_build_object('type','handoff','at',h.updated_at,'title','Commercial handoff · '||h.vacancy_title,'detail',h.status)
      from public.partner_commercial_handoffs h
      where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()
    ) z
  ),'[]'::jsonb)
 );
end
$$;
