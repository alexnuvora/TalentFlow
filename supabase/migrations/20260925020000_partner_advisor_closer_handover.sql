
create table if not exists public.partner_client_handover_requests(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  from_partner uuid not null references public.profiles(id) on delete cascade,
  to_partner uuid references public.profiles(id) on delete set null,
  status text not null default 'requested' check(status in ('requested','assigned','declined','completed')),
  summary text not null,
  manager_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists partner_client_handover_pending_uq
 on public.partner_client_handover_requests(client_id,from_partner)
 where status='requested';
alter table public.partner_client_handover_requests enable row level security;

drop policy if exists "partner client handover read" on public.partner_client_handover_requests;
create policy "partner client handover read" on public.partner_client_handover_requests
for select to authenticated
using(company_id=private.current_company_id() and (private.is_manager() or from_partner=auth.uid() or to_partner=auth.uid()));

create or replace function public.partner_request_closer_handover(p_client uuid,p_summary text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_prospect(auth.uid()) then raise exception 'B2B Advisor or Hybrid Partner access required'; end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client access required'; end if;
 if nullif(btrim(coalesce(p_summary,'')),'') is null or length(btrim(p_summary))<10 then raise exception 'Provide a useful qualification summary for the closer'; end if;
 insert into public.partner_client_handover_requests(company_id,client_id,from_partner,summary)
 values(v_company,p_client,auth.uid(),btrim(p_summary))
 returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'A closer handover is already awaiting manager review for this client';
end
$$;

create or replace function public.review_partner_closer_handover(p_request uuid,p_status text,p_to_partner uuid default null,p_notes text default null)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); r public.partner_client_handover_requests%rowtype; v_specialism text;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('assigned','declined') then raise exception 'Status must be assigned or declined'; end if;
 select * into r from public.partner_client_handover_requests where id=p_request and company_id=v_company and status='requested' for update;
 if not found then raise exception 'Pending client handover not found'; end if;
 if p_status='assigned' then
   if p_to_partner is null then raise exception 'Choose a Lead Closer or Hybrid Partner'; end if;
   select pp.specialism into v_specialism
   from public.partner_profiles pp
   join public.partner_onboarding o on o.partner_id=pp.user_id and o.company_id=pp.company_id
   join public.profiles p on p.id=pp.user_id and p.company_id=pp.company_id and p.role='partner'
   where pp.user_id=p_to_partner and pp.company_id=v_company and pp.active and o.status='active';
   if v_specialism not in ('lead_closer','hybrid') then raise exception 'Selected partner is not an active Lead Closer or Hybrid Partner'; end if;
   if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_to_partner and a.client_id=r.client_id and a.completed_at is null) then
     insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective)
     values(v_company,p_to_partner,r.client_id,'high','Convert qualified employer opportunity into an active Vorlen client and secure the first vacancy.');
   end if;
   update public.partner_assignments set completed_at=coalesce(completed_at,now())
   where company_id=v_company and partner_id=r.from_partner and client_id=r.client_id and completed_at is null;
 end if;
 update public.partner_client_handover_requests
 set status=p_status,to_partner=case when p_status='assigned' then p_to_partner else null end,
     manager_notes=nullif(btrim(coalesce(p_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=r.id;
end
$$;

revoke all on function public.partner_request_closer_handover(uuid,text) from public,anon;
revoke all on function public.review_partner_closer_handover(uuid,text,uuid,text) from public,anon;
grant execute on function public.partner_request_closer_handover(uuid,text) to authenticated;
grant execute on function public.review_partner_closer_handover(uuid,text,uuid,text) to authenticated;
