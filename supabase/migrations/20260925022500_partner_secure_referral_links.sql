
create table if not exists public.partner_referral_links(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  token_hash text not null unique,
  label text,
  active boolean not null default true,
  expires_at timestamptz not null default (now()+interval '180 days'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists partner_referral_links_partner_job_idx
 on public.partner_referral_links(company_id,partner_id,job_id,created_at desc);
alter table public.partner_referral_links enable row level security;

drop policy if exists "partner referral own read" on public.partner_referral_links;
create policy "partner referral own read" on public.partner_referral_links
for select to authenticated
using(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid()));

create or replace function public.partner_create_referral_link(p_job uuid,p_label text default null,p_days integer default 180)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 v_token text;
 v_hash text;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then
   raise exception 'Candidate-sourcing partner access required';
 end if;
 if p_days<1 or p_days>365 then raise exception 'Referral link expiry must be between 1 and 365 days'; end if;
 if not exists(
   select 1 from public.jobs j
   join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id
   where j.id=p_job and j.company_id=v_company and j.status='published'
     and a.partner_id=auth.uid() and a.completed_at is null
 ) then raise exception 'An assigned published vacancy is required'; end if;

 update public.partner_referral_links
 set active=false,revoked_at=coalesce(revoked_at,now())
 where company_id=v_company and partner_id=auth.uid() and job_id=p_job and active=true;

 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

 insert into public.partner_referral_links(company_id,partner_id,job_id,token_hash,label,expires_at)
 values(v_company,auth.uid(),p_job,v_hash,nullif(btrim(coalesce(p_label,'')),''),now()+make_interval(days=>p_days));

 return v_token;
end
$$;

create or replace function public.partner_referral_link_status(p_job uuid)
returns table(id uuid,label text,active boolean,expires_at timestamptz,created_at timestamptz)
language sql
stable
security definer
set search_path=''
as $$
 select r.id,r.label,r.active and r.revoked_at is null and r.expires_at>now(),r.expires_at,r.created_at
 from public.partner_referral_links r
 where r.company_id=private.current_company_id()
   and r.partner_id=auth.uid()
   and r.job_id=p_job
 order by r.created_at desc
 limit 1
$$;

revoke insert,update,delete on public.partner_referral_links from authenticated;
revoke all on function public.partner_create_referral_link(uuid,text,integer) from public,anon;
revoke all on function public.partner_referral_link_status(uuid) from public,anon;
grant execute on function public.partner_create_referral_link(uuid,text,integer) to authenticated;
grant execute on function public.partner_referral_link_status(uuid) to authenticated;
