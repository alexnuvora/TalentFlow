
create or replace function public.cancel_partner_outreach_on_dnc()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if new.status='do_not_contact' and (tg_op='INSERT' or old.status is distinct from new.status) then
   update public.partner_tasks
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status not in ('done','cancelled');

   update public.partner_client_sequences
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','completed');
 end if;
 return new;
end
$$;

create or replace function public.cancel_partner_work_on_client_unassignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if old.client_id is not null
    and old.completed_at is null
    and new.completed_at is not null
    and not exists(
      select 1 from public.partner_assignments a
      where a.company_id=new.company_id
        and a.partner_id=new.partner_id
        and a.client_id=new.client_id
        and a.completed_at is null
        and a.id<>new.id
    ) then

   update public.partner_tasks
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status not in ('done','cancelled');

   update public.partner_client_sequences
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','completed');
 end if;
 return new;
end
$$;
