drop policy if exists "partner notes read workspace" on public.partner_client_notes;
create policy "partner notes assigned client read"
on public.partner_client_notes for select to authenticated
using (
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      private.partner_is_active()
      and exists (
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_notes.company_id
          and a.partner_id=auth.uid()
          and a.client_id=partner_client_notes.client_id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner notes insert own" on public.partner_client_notes;
create policy "partner notes insert assigned client"
on public.partner_client_notes for insert to authenticated
with check (
  company_id=private.current_company_id()
  and partner_id=auth.uid()
  and private.partner_is_active()
  and exists (
    select 1 from public.partner_assignments a
    where a.company_id=partner_client_notes.company_id
      and a.partner_id=auth.uid()
      and a.client_id=partner_client_notes.client_id
      and a.completed_at is null
  )
);

drop policy if exists "partner activity own workspace" on public.partner_client_activity;
create policy "partner activity assigned client"
on public.partner_client_activity for all to authenticated
using (
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      partner_id=auth.uid()
      and private.partner_is_active()
      and exists (
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=auth.uid()
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
)
with check (
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      partner_id=auth.uid()
      and private.partner_is_active()
      and exists (
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=auth.uid()
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
);

create or replace function public.enforce_partner_task_scope()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  if v_manager then return new; end if;
  if not private.partner_is_active() then raise exception 'Active partner access required'; end if;
  if tg_op='INSERT' then new.company_id:=private.current_company_id();new.partner_id:=auth.uid();
  else
    if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then raise exception 'You may only update your own partner tasks'; end if;
    new.company_id:=old.company_id;new.partner_id:=old.partner_id;
  end if;
  if new.client_id is not null and not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.client_id=new.client_id and a.completed_at is null) then raise exception 'Task client is not assigned to your portfolio';end if;
  if new.candidate_id is not null and not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.candidate_id=new.candidate_id and a.completed_at is null) then raise exception 'Task candidate is not assigned to your portfolio';end if;
  if new.job_id is not null and not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.job_id=new.job_id and a.completed_at is null) then raise exception 'Task vacancy is not assigned to your portfolio';end if;
  return new;
end $$;

drop trigger if exists trg_partner_task_scope on public.partner_tasks;
create trigger trg_partner_task_scope before insert or update on public.partner_tasks
for each row execute function public.enforce_partner_task_scope();

revoke all on function public.enforce_partner_task_scope() from public,anon,authenticated;
grant execute on function public.enforce_partner_task_scope() to service_role;
