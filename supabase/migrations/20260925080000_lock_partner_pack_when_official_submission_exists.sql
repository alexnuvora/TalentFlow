
create or replace function public.sync_partner_submission_pack_to_client_submission()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.partner_submission_packs p
  set candidate_submission_id=new.id,
      status=case
        when new.status not in ('draft','reserved','approved_to_send','withdrawn') then 'submitted'
        else p.status
      end,
      updated_at=now()
  where p.company_id=new.company_id
    and p.job_id=new.job_id
    and p.candidate_id=new.candidate_id
    and p.client_id=new.client_id
    and p.status in ('requested','approved','submitted');

  return new;
end
$$;

update public.partner_submission_packs p
set candidate_submission_id=s.id,
    status=case
      when s.status not in ('draft','reserved','approved_to_send','withdrawn') then 'submitted'
      else p.status
    end,
    updated_at=now()
from public.candidate_submissions s
where p.company_id=s.company_id
  and p.client_id=s.client_id
  and p.job_id=s.job_id
  and p.candidate_id=s.candidate_id
  and p.status in ('requested','approved','submitted')
  and (p.candidate_submission_id is null or p.candidate_submission_id<>s.id);
