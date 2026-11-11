-- Allow authorised commercial users to manage the company's VAT registration
-- without granting broad UPDATE access to the companies table.
alter table public.companies
  add constraint companies_vat_number_required_when_registered
  check (not vat_registered or nullif(btrim(vat_number),'') is not null);

create or replace function public.update_company_vat_settings(
  p_vat_registered boolean,
  p_vat_rate numeric default 20,
  p_vat_number text default null,
  p_vat_effective_from date default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company uuid;
  v_role text;
begin
  select company_id, role
  into v_company, v_role
  from public.profiles
  where id = auth.uid();

  if v_company is null or v_role not in ('owner','manager') then
    raise exception 'Not authorised to update company VAT settings';
  end if;

  if p_vat_rate is null or p_vat_rate < 0 or p_vat_rate > 100 then
    raise exception 'VAT rate must be between 0 and 100';
  end if;

  if coalesce(p_vat_registered,false) and nullif(btrim(p_vat_number),'') is null then
    raise exception 'VAT registration number is required when VAT registration is enabled';
  end if;

  update public.companies
  set vat_registered = coalesce(p_vat_registered,false),
      vat_rate = p_vat_rate,
      vat_number = case when coalesce(p_vat_registered,false) then btrim(p_vat_number) else null end,
      vat_effective_from = case when coalesce(p_vat_registered,false) then p_vat_effective_from else null end
  where id = v_company;

  if not found then raise exception 'Company not found'; end if;
end;
$function$;

revoke all on function public.update_company_vat_settings(boolean,numeric,text,date) from public, anon;
grant execute on function public.update_company_vat_settings(boolean,numeric,text,date) to authenticated;
