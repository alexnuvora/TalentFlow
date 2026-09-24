create table if not exists public.partner_prospects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  company_name text not null,
  website text, contact_name text, contact_email text, contact_phone text,
  business_nature text, hiring_need text, notes text,
  status text not null default 'prospect'
    check (status in ('prospect','contacted','interested','handoff_ready','under_review','promoted','declined','do_not_contact')),
  promoted_client_id uuid references public.clients(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, manager_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_partner_prospects_partner on public.partner_prospects(company_id,partner_id,status,updated_at desc);
create index if not exists idx_partner_prospects_company_name on public.partner_prospects(company_id,lower(company_name));
create index if not exists idx_partner_prospects_email on public.partner_prospects(company_id,lower(contact_email)) where contact_email is not null;
alter table public.partner_prospects enable row level security;
create policy "partner prospects select" on public.partner_prospects for select to authenticated using (company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active())));
create policy "partner prospects insert" on public.partner_prospects for insert to authenticated with check (company_id=private.current_company_id() and partner_id=auth.uid() and private.partner_is_active());
create policy "partner prospects update" on public.partner_prospects for update to authenticated using (company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active()))) with check (company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active())));
create or replace function public.enforce_partner_prospect_boundary() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_manager boolean:=current_user in ('postgres','service_role') or private.is_manager();
begin
 new.updated_at:=now();
 if v_manager then
   if new.status in ('promoted','declined') and new.reviewed_at is null then new.reviewed_at:=now();new.reviewed_by:=coalesce(new.reviewed_by,auth.uid());end if;
   if new.status='promoted' and new.promoted_client_id is null then raise exception 'Promoted prospect must reference the authoritative client record';end if;
   return new;
 end if;
 if not private.partner_is_active() then raise exception 'Active partner access required';end if;
 if tg_op='INSERT' then
   new.company_id:=private.current_company_id();new.partner_id:=auth.uid();new.promoted_client_id:=null;new.reviewed_by:=null;new.reviewed_at:=null;new.manager_notes:=null;
   if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact') then new.status:='prospect';end if;
 else
   if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then raise exception 'You may only update your own prospects';end if;
   if old.status in ('under_review','promoted','declined') then raise exception 'This prospect is locked for Vorlen review';end if;
   new.company_id:=old.company_id;new.partner_id:=old.partner_id;new.promoted_client_id:=old.promoted_client_id;new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.manager_notes:=old.manager_notes;
   if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact','under_review') then raise exception 'Partners cannot approve or promote prospects';end if;
 end if;
 if nullif(btrim(new.company_name),'') is null then raise exception 'Company name is required';end if;
 return new;
end $$;
create trigger trg_partner_prospect_boundary before insert or update on public.partner_prospects for each row execute function public.enforce_partner_prospect_boundary();
revoke all on table public.partner_prospects from anon;
grant select,insert,update on table public.partner_prospects to authenticated;
grant all on table public.partner_prospects to service_role;

create or replace function private.create_partner_prospect_impl(p_company_name text,p_website text default null,p_contact_name text default null,p_contact_email text default null,p_contact_phone text default null,p_business_nature text default null,p_hiring_need text default null,p_notes text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_name text:=btrim(p_company_name);v_email text:=nullif(lower(btrim(p_contact_email)),'');
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
 if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
 if nullif(v_name,'') is null then raise exception 'Company name is required';end if;
 if exists(select 1 from public.clients c where c.company_id=v_company and (lower(btrim(c.company_name))=lower(v_name) or (v_email is not null and lower(btrim(c.email))=v_email))) then raise exception 'This company or contact already exists as a Vorlen client. Ask a manager to assign the existing record.';end if;
 if exists(select 1 from public.partner_prospects p where p.company_id=v_company and p.status not in ('declined','do_not_contact') and (lower(btrim(p.company_name))=lower(v_name) or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email))) then raise exception 'A matching prospect already exists in Vorlen. Ask a manager to review ownership rather than creating a duplicate.';end if;
 insert into public.partner_prospects(company_id,partner_id,company_name,website,contact_name,contact_email,contact_phone,business_nature,hiring_need,notes)
 values(v_company,v_user,v_name,nullif(btrim(p_website),''),nullif(btrim(p_contact_name),''),v_email,nullif(btrim(p_contact_phone),''),nullif(btrim(p_business_nature),''),nullif(btrim(p_hiring_need),''),nullif(btrim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;
revoke all on function private.create_partner_prospect_impl(text,text,text,text,text,text,text,text) from public,anon;
grant execute on function private.create_partner_prospect_impl(text,text,text,text,text,text,text,text) to authenticated,service_role;
create or replace function public.create_partner_prospect(p_company_name text,p_website text default null,p_contact_name text default null,p_contact_email text default null,p_contact_phone text default null,p_business_nature text default null,p_hiring_need text default null,p_notes text default null) returns uuid language plpgsql security invoker set search_path='' as $$
begin return private.create_partner_prospect_impl(p_company_name,p_website,p_contact_name,p_contact_email,p_contact_phone,p_business_nature,p_hiring_need,p_notes);end $$;
revoke all on function public.create_partner_prospect(text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_partner_prospect(text,text,text,text,text,text,text,text) to authenticated,service_role;

alter table public.partner_commercial_handoffs add column if not exists prospect_id uuid references public.partner_prospects(id) on delete set null;
create index if not exists idx_partner_handoffs_prospect on public.partner_commercial_handoffs(company_id,prospect_id) where prospect_id is not null;
