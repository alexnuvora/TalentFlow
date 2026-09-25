update public.automation_sequences
set from_name=coalesce(nullif(btrim(from_name),''),'Vorlen'),
    from_address='contact@vorlen.co.uk',
    updated_at=now()
where channel='email'
  and coalesce(lower(from_address),'')<>'contact@vorlen.co.uk';
