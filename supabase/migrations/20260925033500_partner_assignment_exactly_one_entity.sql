
do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.partner_assignments'::regclass
      and conname='partner_assignments_exactly_one_entity'
  ) then
    alter table public.partner_assignments
      add constraint partner_assignments_exactly_one_entity
      check (num_nonnulls(client_id,candidate_id,job_id)=1);
  end if;
end $$;
