alter table public.client_contracts
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_terms_document_id uuid,
  add column if not exists source_terms_version text,
  add column if not exists source_terms_accepted_at timestamptz,
  add column if not exists rebate_terms_snapshot text,
  add column if not exists acceptance_evidence_snapshot text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='client_contracts_source_type_check'
      and conrelid='public.client_contracts'::regclass
  ) then
    alter table public.client_contracts
      add constraint client_contracts_source_type_check
      check (source_type in ('manual','terms_acceptance'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='client_contracts_source_terms_document_id_fkey'
      and conrelid='public.client_contracts'::regclass
  ) then
    alter table public.client_contracts
      add constraint client_contracts_source_terms_document_id_fkey
      foreign key (source_terms_document_id)
      references public.client_terms_documents(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists uq_client_contracts_terms_document
  on public.client_contracts(source_terms_document_id)
  where source_terms_document_id is not null;

create unique index if not exists uq_client_contracts_terms_acceptance
  on public.client_contracts(client_id,source_terms_accepted_at)
  where source_type='terms_acceptance' and source_terms_accepted_at is not null;

create or replace function private.sync_terms_contract_for_client(p_client uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_client public.clients%rowtype;
  v_doc public.client_terms_documents%rowtype;
  v_existing uuid;
  v_contract uuid;
  v_conflict boolean:=false;
  v_status public.contract_status:='active';
begin
  select * into v_client
  from public.clients
  where id=p_client
  for update;

  if not found then raise exception 'Client not found'; end if;
  if v_client.terms_accepted_at is null then raise exception 'Client terms have not been accepted'; end if;
  if v_client.recruitment_fee_percent is null
     or v_client.payment_terms_days is null
     or nullif(btrim(v_client.rebate_terms),'') is null
     or nullif(btrim(v_client.business_nature),'') is null then
    raise exception 'Accepted client terms are incomplete';
  end if;

  select d.* into v_doc
  from public.client_terms_documents d
  where d.client_id=v_client.id
    and d.company_id=v_client.company_id
    and d.status='accepted'
    and d.accepted_at=v_client.terms_accepted_at
  order by d.accepted_at desc
  limit 1;

  select cc.id into v_existing
  from public.client_contracts cc
  where cc.client_id=v_client.id
    and cc.company_id=v_client.company_id
    and cc.source_type='terms_acceptance'
    and cc.source_terms_accepted_at=v_client.terms_accepted_at
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select exists(
    select 1
    from public.client_contracts cc
    where cc.client_id=v_client.id
      and cc.company_id=v_client.company_id
      and cc.status='active'
      and cc.source_type='manual'
      and (
        cc.fee_model<>'percentage_salary'::public.fee_model
        or cc.fee_percentage is distinct from v_client.recruitment_fee_percent
        or cc.payment_terms_days is distinct from v_client.payment_terms_days
      )
  ) into v_conflict;

  if v_conflict then
    v_status:='paused';
  else
    update public.client_contracts
    set status='expired',
        updated_at=now(),
        notes=concat_ws(E'\n',nullif(notes,''),'Superseded by later accepted Vorlen Terms of Business.')
    where client_id=v_client.id
      and company_id=v_client.company_id
      and status='active'
      and source_type='terms_acceptance'
      and source_terms_accepted_at is distinct from v_client.terms_accepted_at;
  end if;

  insert into public.client_contracts(
    company_id,client_id,name,status,fee_model,fee_percentage,
    flat_fee,default_initial_fee,replacement_days,candidate_ownership_days,
    vat_rate,payment_terms_days,currency,signed_at,notes,
    source_type,source_terms_document_id,source_terms_version,source_terms_accepted_at,
    rebate_terms_snapshot,acceptance_evidence_snapshot
  )
  values(
    v_client.company_id,
    v_client.id,
    'Vorlen Terms of Business — '||coalesce(v_client.terms_version,'accepted terms'),
    v_status,
    'percentage_salary',
    v_client.recruitment_fee_percent,
    null,
    null,
    0,
    0,
    20,
    v_client.payment_terms_days,
    'GBP',
    v_client.terms_accepted_at,
    case
      when v_conflict then
        'Automatically created from accepted Terms of Business but PAUSED because an active manual contract has materially different fee/payment terms. Manager review is required before this contract can govern new work.'
      else
        'Automatically created from accepted Vorlen Terms of Business. Free-text rebate/replacement terms are preserved verbatim in rebate_terms_snapshot; no unagreed numeric guarantee or candidate-ownership period is inferred.'
    end,
    'terms_acceptance',
    v_doc.id,
    v_client.terms_version,
    v_client.terms_accepted_at,
    v_client.rebate_terms,
    v_client.terms_evidence
  )
  returning id into v_contract;

  return v_contract;
end
$function$;

create or replace function public.protect_accepted_client_terms()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.terms_accepted_at is not null
     and new.terms_accepted_at=old.terms_accepted_at
     and (
       new.business_nature is distinct from old.business_nature
       or new.recruitment_fee_percent is distinct from old.recruitment_fee_percent
       or new.payment_terms_days is distinct from old.payment_terms_days
       or new.rebate_terms is distinct from old.rebate_terms
       or new.terms_version is distinct from old.terms_version
       or new.terms_accepted_by is distinct from old.terms_accepted_by
       or new.terms_acceptance_method is distinct from old.terms_acceptance_method
       or new.terms_evidence is distinct from old.terms_evidence
     ) then
    raise exception 'Accepted commercial terms are immutable. Clear/supersede the acceptance and issue revised Terms of Business.';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_protect_accepted_client_terms on public.clients;
create trigger trg_protect_accepted_client_terms
before update on public.clients
for each row execute function public.protect_accepted_client_terms();

create or replace function public.sync_client_contract_after_terms_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.terms_accepted_at is not null
     and new.terms_accepted_at is distinct from old.terms_accepted_at then
    perform private.sync_terms_contract_for_client(new.id);
  elsif old.terms_accepted_at is not null and new.terms_accepted_at is null then
    update public.client_contracts
    set status='expired',
        updated_at=now(),
        notes=concat_ws(E'\n',nullif(notes,''),'Terms acceptance was cleared/superseded; this generated contract is no longer active.')
    where client_id=new.id
      and company_id=new.company_id
      and source_type='terms_acceptance'
      and source_terms_accepted_at=old.terms_accepted_at
      and status in ('active','paused');
  end if;
  return new;
end
$function$;

drop trigger if exists trg_sync_client_contract_after_terms_change on public.clients;
create trigger trg_sync_client_contract_after_terms_change
after update on public.clients
for each row execute function public.sync_client_contract_after_terms_change();

create or replace function public.service_accept_client_terms(
  p_document uuid,
  p_name text,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_doc public.client_terms_documents%rowtype;
  v_now timestamptz:=now();
  v_contract uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' and current_user<>'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(btrim(p_name),'') is null or length(btrim(p_name))<2 then
    raise exception 'Name is required';
  end if;

  select * into v_doc
  from public.client_terms_documents
  where id=p_document
  for update;

  if not found then raise exception 'Terms document not found'; end if;
  if v_doc.token_expires_at is null or v_doc.token_expires_at<=v_now then
    raise exception 'This Terms of Business link has expired';
  end if;
  if v_doc.status not in ('sent','viewed') then
    raise exception 'These Terms of Business have already been completed or superseded';
  end if;

  update public.client_terms_documents
  set status='accepted',
      accepted_at=v_now,
      accepted_name=btrim(p_name),
      accepted_email=v_doc.recipient_email,
      acceptance_ip=nullif(btrim(coalesce(p_ip,'')),''),
      acceptance_user_agent=nullif(p_user_agent,''),
      acceptance_method='secure_link',
      updated_at=v_now
  where id=v_doc.id;

  update public.clients
  set terms_version=v_doc.version,
      terms_accepted_at=v_now,
      terms_accepted_by=btrim(p_name),
      terms_acceptance_method='secure_link',
      terms_evidence='Accepted secure Terms of Business document '||v_doc.id::text,
      status='active'
  where id=v_doc.client_id
    and company_id=v_doc.company_id;

  if not found then
    raise exception 'Client record could not be updated';
  end if;

  select cc.id into v_contract
  from public.client_contracts cc
  where cc.client_id=v_doc.client_id
    and cc.company_id=v_doc.company_id
    and cc.source_type='terms_acceptance'
    and cc.source_terms_accepted_at=v_now
  limit 1;

  return jsonb_build_object(
    'ok',true,
    'accepted_at',v_now,
    'version',v_doc.version,
    'contract_id',v_contract,
    'contract_status',(select status::text from public.client_contracts where id=v_contract)
  );
end
$function$;

revoke all on function public.service_accept_client_terms(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.service_accept_client_terms(uuid,text,text,text) to service_role;

create or replace function public.approve_partner_handoff_and_create_vacancy(
  p_handoff uuid,
  p_manager_notes text default null
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_company uuid:=private.current_company_id();
  v_handoff public.partner_commercial_handoffs%rowtype;
  v_client public.clients%rowtype;
  v_contract uuid;
  v_job uuid;
  v_slug text;
  v_existing_partner uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select * into v_handoff
  from public.partner_commercial_handoffs
  where id=p_handoff and company_id=v_company
  for update;

  if not found then raise exception 'Commercial handoff not found'; end if;

  if v_handoff.status='converted' then
    return jsonb_build_object('ok',true,'handoff_id',v_handoff.id,'job_id',v_handoff.approved_job_id,'status','converted','idempotent',true);
  end if;

  if v_handoff.status not in ('submitted','under_review','terms_approved') then
    raise exception 'Only a submitted or reviewed handoff can be approved';
  end if;
  if v_handoff.client_id is null then raise exception 'Attach the approved Vorlen client before approval'; end if;

  select * into v_client
  from public.clients
  where id=v_handoff.client_id and company_id=v_company;

  if not found then raise exception 'Client not found in this workspace'; end if;
  if v_client.terms_accepted_at is null then raise exception 'Client must accept Vorlen Terms of Business before handoff approval'; end if;

  select cc.id into v_contract
  from public.client_contracts cc
  where cc.company_id=v_company
    and cc.client_id=v_client.id
    and cc.status='active'
    and cc.source_type='terms_acceptance'
    and cc.source_terms_accepted_at=v_client.terms_accepted_at
  order by cc.signed_at desc nulls last,cc.created_at desc
  limit 1;

  if v_contract is null then
    raise exception 'The latest accepted Terms of Business do not have an active matching client contract. Resolve any commercial contract conflict first.';
  end if;

  if v_handoff.approved_job_id is not null then
    select j.id into v_job
    from public.jobs j
    where j.id=v_handoff.approved_job_id
      and j.company_id=v_company
      and j.client_id=v_client.id;
  end if;

  if v_job is null then
    v_slug:=trim(both '-' from regexp_replace(lower(v_handoff.vacancy_title),'[^a-z0-9]+','-','g'))
            ||'-'||left(replace(v_handoff.id::text,'-',''),8);

    insert into public.jobs(
      company_id,client_id,title,slug,description,employment_type,location,
      commission_text,status,requirements,application_mode,
      genuine_vacancy_confirmed_at,client_instruction_reference
    )
    values(
      v_company,
      v_client.id,
      v_handoff.vacancy_title,
      v_slug,
      concat_ws(E'\n\n',
        nullif(btrim(v_handoff.hiring_need),''),
        case when nullif(btrim(coalesce(v_handoff.commercial_request,'')),'') is not null
             then 'Client request / commercial context: '||btrim(v_handoff.commercial_request)
             else null end
      ),
      'Permanent',
      coalesce(nullif(btrim(coalesce(v_handoff.vacancy_location,'')),''),'UK'),
      nullif(btrim(coalesce(v_handoff.salary_context,'')),''),
      'draft',
      '{}'::text[],
      'apply',
      now(),
      'partner_handoff:'||v_handoff.id::text
    )
    returning id into v_job;
  end if;

  update public.partner_commercial_handoffs
  set status='converted',
      manager_notes=nullif(btrim(coalesce(p_manager_notes,'')),''),
      approved_by=auth.uid(),
      approved_at=now(),
      approved_job_id=v_job,
      updated_at=now()
  where id=v_handoff.id;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=v_company
      and a.partner_id=v_handoff.partner_id
      and a.job_id=v_job
      and a.completed_at is null
  ) then
    insert into public.partner_assignments(company_id,partner_id,job_id,priority,objective)
    values(v_company,v_handoff.partner_id,v_job,'high','Deliver approved Vorlen vacancy');
  end if;

  select a.partner_id into v_existing_partner
  from public.partner_attributions a
  where a.company_id=v_company
    and a.job_id=v_job
    and a.attribution_type='vacancy_originator'
    and a.status='active'
  limit 1;

  if v_existing_partner is null then
    insert into public.partner_attributions(
      company_id,partner_id,job_id,attribution_type,evidence,attributed_by
    )
    values(
      v_company,v_handoff.partner_id,v_job,'vacancy_originator',
      'Vacancy created from approved partner commercial handoff '||v_handoff.id::text,
      auth.uid()
    );
  elsif v_existing_partner<>v_handoff.partner_id then
    raise exception 'This vacancy already has a different active partner originator';
  end if;

  return jsonb_build_object(
    'ok',true,
    'handoff_id',v_handoff.id,
    'contract_id',v_contract,
    'job_id',v_job,
    'job_status','draft',
    'status','converted'
  );
end
$function$;

grant execute on function public.approve_partner_handoff_and_create_vacancy(uuid,text) to authenticated;

do $$
declare r record;
begin
  for r in
    select c.id
    from public.clients c
    where c.terms_accepted_at is not null
      and c.recruitment_fee_percent is not null
      and c.payment_terms_days is not null
      and nullif(btrim(c.rebate_terms),'') is not null
      and nullif(btrim(c.business_nature),'') is not null
  loop
    perform private.sync_terms_contract_for_client(r.id);
  end loop;
end $$;
