update public.companies
set legal_address='10 South Street, Rochdale, United Kingdom, OL16 2EP',
    compliance_updated_at=now()
where legal_name='IVY AND PEARLS LTD'
  and company_registration_number='17387520';
