
-- Final partner workflow hardening: sequence integrity and RPC-only writes.

create or replace function public.enforce_partner_task_scope()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
  v_sequence public.partner_client_sequences%rowtype;
begin
  if v_manager then return new; end if;

  if not private.partner_is_active() then
    raise exception 'Active partner access required';
  end if;

  if tg_op='INSERT' then
    new.company_id := private.current_company_id();
    new.partner_id := auth.uid();

    -- Sequence membership is created only by the controlled sequence RPC.
    -- A partner-created ad-hoc task must not be able to attach itself to a workflow.
    if new.sequence_id is not null then
      raise exception 'Sequence-managed tasks can only be created through a Vorlen workflow';
    end if;
  else
    if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then
      raise exception 'You may only update your own partner tasks';
    end if;

    new.company_id := old.company_id;
    new.partner_id := old.partner_id;
    new.sequence_id := old.sequence_id;

    if old.sequence_id is not null then
      select * into v_sequence
      from public.partner_client_sequences s
      where s.id=old.sequence_id
        and s.company_id=old.company_id
        and s.partner_id=old.partner_id;

      if not found then
        raise exception 'Sequence workflow could not be verified';
      end if;

      -- Preserve the workflow definition and entity scope. Partners may complete,
      -- cancel or reschedule sequence tasks, but cannot repoint/rewrite the workflow.
      new.client_id := old.client_id;
      new.candidate_id := old.candidate_id;
      new.job_id := old.job_id;
      new.title := old.title;
      new.description := old.description;
      new.task_type := old.task_type;
      new.priority := old.priority;
    end if;
  end if;

  if new.client_id is not null and not exists (
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.client_id=new.client_id and a.completed_at is null
  ) then
    raise exception 'Task client is not assigned to your portfolio';
  end if;

  if new.candidate_id is not null and not exists (
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.candidate_id=new.candidate_id and a.completed_at is null
  ) then
    raise exception 'Task candidate is not assigned to your portfolio';
  end if;

  if new.job_id is not null and not exists (
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.job_id=new.job_id and a.completed_at is null
  ) then
    raise exception 'Task vacancy is not assigned to your portfolio';
  end if;

  return new;
end
$$;

drop policy if exists "partner tasks delete" on public.partner_tasks;
create policy "partner tasks delete" on public.partner_tasks
for delete to authenticated
using(
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      partner_id=(select auth.uid())
      and private.partner_is_active()
      and sequence_id is null
    )
  )
);

-- Workflow rows and talent-pool definitions are mutated only through checked RPCs.
revoke insert,update,delete on public.partner_client_sequences from authenticated;
revoke insert,update,delete on public.partner_talent_pools from authenticated;
