
create or replace function public.enforce_partner_handoff_boundary()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_privileged boolean := current_user in ('postgres','service_role') or private.is_manager();
  v_prospect public.partner_prospects%rowtype;
  v_terms_accepted_at timestamptz;
begin
  new.updated_at := now();

  if v_privileged then
    if new.prospect_id is not null then
      select * into v_prospect
      from public.partner_prospects p
      where p.id=new.prospect_id and p.company_id=new.company_id;

      if v_prospect.id is null then raise exception 'Prospect not found in this workspace'; end if;
      if new.client_id is null and v_prospect.promoted_client_id is not null then
        new.client_id:=v_prospect.promoted_client_id;
      end if;
    end if;

    if new.status in ('terms_approved','converted') then
      if new.client_id is null then
        raise exception 'Attach the approved client before approving commercial terms';
      end if;

      select c.terms_accepted_at into v_terms_accepted_at
      from public.clients c
      where c.id=new.client_id and c.company_id=new.company_id;

      if v_terms_accepted_at is null then
        raise exception 'Client must accept Vorlen Terms of Business before commercial approval';
      end if;

      if not exists(
        select 1
        from public.client_contracts cc
        where cc.company_id=new.company_id
          and cc.client_id=new.client_id
          and cc.status='active'
          and cc.source_type='terms_acceptance'
          and cc.source_terms_accepted_at=v_terms_accepted_at
      ) then
        raise exception 'The latest accepted Terms of Business must have an active matching client contract';
      end if;

      if new.approved_at is null then
        new.approved_at:=now();
        new.approved_by:=coalesce(new.approved_by,auth.uid());
      end if;
    end if;

    if new.status='converted' then
      if new.approved_job_id is null then
        raise exception 'A live vacancy must be linked before a handoff can be converted';
      end if;
      if not exists(
        select 1 from public.jobs j
        where j.id=new.approved_job_id
          and j.company_id=new.company_id
          and j.client_id=new.client_id
      ) then
        raise exception 'The linked vacancy must belong to the approved client';
      end if;
    end if;
    return new;
  end if;

  if not private.partner_can_close_clients(auth.uid()) then
    raise exception 'Commercial handoffs are only enabled for Lead Closer and Hybrid Partner profiles';
  end if;

  if tg_op='INSERT' then
    new.company_id:=private.current_company_id();
    new.partner_id:=auth.uid();
    new.manager_notes:=null;
    new.approved_by:=null;
    new.approved_at:=null;
    new.approved_job_id:=null;
    if new.status not in ('draft','submitted') then new.status:='draft'; end if;
  else
    if old.partner_id<>auth.uid() or old.company_id<>private.current_company_id() then
      raise exception 'You may only update your own commercial handoffs';
    end if;
    if old.status<>'draft' then
      raise exception 'Submitted handoffs are locked while Vorlen reviews them';
    end if;
    new.company_id:=old.company_id;
    new.partner_id:=old.partner_id;
    new.manager_notes:=old.manager_notes;
    new.approved_by:=old.approved_by;
    new.approved_at:=old.approved_at;
    new.approved_job_id:=old.approved_job_id;
    if new.status not in ('draft','submitted') then
      raise exception 'Partners can only save a draft or submit for Vorlen review';
    end if;
  end if;

  if new.client_id is not null and new.prospect_id is not null then
    raise exception 'Choose either an assigned client or a partner prospect, not both';
  end if;

  if new.client_id is not null and not exists(
    select 1 from public.partner_assignments a
    where a.company_id=new.company_id and a.partner_id=auth.uid()
      and a.client_id=new.client_id and a.completed_at is null
  ) then
    raise exception 'The selected client is not assigned to your partner portfolio';
  end if;

  if new.prospect_id is not null then
    select * into v_prospect
    from public.partner_prospects p
    where p.id=new.prospect_id
      and p.company_id=new.company_id
      and p.partner_id=auth.uid()
      and p.status not in ('declined','do_not_contact');

    if v_prospect.id is null then
      raise exception 'The selected prospect is not available in your portfolio';
    end if;

    new.prospect_company:=v_prospect.company_name;
    new.contact_name:=v_prospect.contact_name;
    new.contact_email:=v_prospect.contact_email;
    new.contact_phone:=v_prospect.contact_phone;
  end if;

  return new;
end
$$;
