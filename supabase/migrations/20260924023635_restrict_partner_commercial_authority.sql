drop policy if exists "contracts tenant" on public.client_contracts;

comment on table public.client_contracts is
'Vorlen-controlled client commercial agreements. Authenticated access is restricted by RLS to authorised managers; recruitment partners may develop relationships but cannot approve or vary fees, payment terms, rebates, guarantees, exclusivity, candidate ownership or other binding client terms.';
