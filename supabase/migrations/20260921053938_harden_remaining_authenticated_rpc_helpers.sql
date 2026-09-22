-- Candidate helper is not needed while candidate processing is disabled.
revoke execute on function public.has_candidate_data_access() from public,anon,authenticated;

-- Read-only tenant/role helpers do not need elevated privileges.
alter function public.current_company_id() security invoker;
alter function public.is_manager() security invoker;
alter function public.partner_is_active(uuid) security invoker;
alter function public.require_workspace_feature(text) security invoker;

-- Placement fee calculation must be tenant scoped before retaining elevated execution.
create or replace function public.calculate_placement_fee(p_contract_id uuid,p_annual_salary numeric,p_initial_fee numeric,p_first_year_revenue numeric)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare c public.client_contracts%rowtype; base numeric:=0; v_company uuid;
begin
 select company_id into v_company from public.profiles where id=auth.uid();
 if v_company is null then raise exception 'Not authorised'; end if;
 select * into c from public.client_contracts where id=p_contract_id and company_id=v_company;
 if not found then raise exception 'Contract not found'; end if;
 if c.fee_model='percentage_salary' then base:=coalesce(p_annual_salary,0); return round(base*coalesce(c.fee_percentage,0)/100,2);
 elsif c.fee_model='flat_fee' then return round(coalesce(c.flat_fee,0),2);
 elsif c.fee_model='percentage_initial_fee' then base:=coalesce(p_initial_fee,c.default_initial_fee,0); return round(base*coalesce(c.fee_percentage,0)/100,2);
 elsif c.fee_model='percentage_first_year_revenue' then base:=coalesce(p_first_year_revenue,0); return round(base*coalesce(c.fee_percentage,0)/100,2);
 end if; return 0;
end $$;
revoke all on function public.calculate_placement_fee(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.calculate_placement_fee(uuid,numeric,numeric,numeric) to authenticated,service_role;
