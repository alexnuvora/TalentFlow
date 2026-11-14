-- Reissue pending split-commission partner terms under the current registered legal identity.
-- Previously accepted v2 agreements remain immutable historical records.

do $migration$
declare
  v_definition text;
  v_signature regprocedure;
  v_signatures regprocedure[] := array[
    'public.issue_partner_commission_terms(uuid)'::regprocedure,
    'private.accept_partner_agreement_impl(uuid,text,text)'::regprocedure,
    'private.initialise_partner_onboarding_impl(uuid,uuid,text)'::regprocedure,
    'private.attribute_partner_entity_impl(uuid,text,uuid,text)'::regprocedure
  ];
  v_old_party text := 'These terms are between Ivy and Pearls Ltd trading as Vorlen, company number 17387520, registered in England and Wales with registered office at 10 South Street, Rochdale, United Kingdom, OL16 2EP ("Vorlen")';
  v_new_party text := 'These terms are between VORLEN LTD trading as Vorlen, company number 17387520, registered in England and Wales with registered office at Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE ("Vorlen")';
  v_old_version text := 'partner-2026-09-26-split-v2';
  v_new_version text := 'partner-2026-11-14-split-v3';
begin
  v_definition := pg_get_functiondef('private.partner_agreement_terms()'::regprocedure);
  if position(v_old_party in v_definition) = 0 then
    raise exception 'Expected previous partner legal identity was not found; refusing to rewrite partner terms';
  end if;
  v_definition := replace(v_definition, v_old_party, v_new_party);
  v_definition := replace(v_definition, v_old_version, v_new_version);
  execute v_definition;

  foreach v_signature in array v_signatures loop
    v_definition := pg_get_functiondef(v_signature);
    if position(v_old_version in v_definition) = 0 then
      raise exception 'Expected previous partner agreement version was not found in %', v_signature;
    end if;
    v_definition := replace(v_definition, v_old_version, v_new_version);
    execute v_definition;
  end loop;
end
$migration$;

-- Supersede only unaccepted v2 agreements. Accepted agreements remain immutable.
update public.partner_agreements
set status = 'superseded'
where commission_model = 'split_15_15'
  and version = 'partner-2026-09-26-split-v2'
  and status = 'pending';

-- Issue the corrected v3 terms to every partner who is not suspended or terminated.
insert into public.partner_agreements(
  company_id,
  partner_id,
  version,
  status,
  commission_percent,
  client_commission_percent,
  candidate_commission_percent,
  commission_model,
  terms_text,
  terms_hash
)
select
  o.company_id,
  o.partner_id,
  'partner-2026-11-14-split-v3',
  'pending',
  30,
  15,
  15,
  'split_15_15',
  private.partner_agreement_terms(),
  encode(extensions.digest(private.partner_agreement_terms(), 'sha256'), 'hex')
from public.partner_onboarding o
join public.profiles p
  on p.id = o.partner_id
 and p.company_id = o.company_id
 and p.role = 'partner'
where o.status not in ('suspended', 'terminated')
  and not exists (
    select 1
    from public.partner_agreements a
    where a.company_id = o.company_id
      and a.partner_id = o.partner_id
      and a.version = 'partner-2026-11-14-split-v3'
  );
