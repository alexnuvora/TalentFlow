-- Backfill partner onboarding for legacy partner-role accounts created before onboarding was introduced.
with missing as (
 select p.id partner_id,p.company_id
 from public.profiles p left join public.partner_onboarding o on o.partner_id=p.id
 where p.role='partner' and o.partner_id is null
), ins as (
 insert into public.partner_agreements(company_id,partner_id,version,status,commission_percent,terms_text)
 select company_id,partner_id,'partner-2026-09-21','pending',30,$terms$Vorlen Recruitment Partner Agreement
1. Appointment. The partner acts as an independent recruitment/business-development partner and is not an employee, agent with authority to bind Vorlen, or authorised to vary Vorlen client terms.
2. Scope. Work is limited to permanent recruitment activity authorised through Vorlen. The partner must use Vorlen systems for client, vacancy, candidate and introduction records.
3. Commission. The standard partner share is 30% of qualifying recruitment fees actually received by Vorlen for a placement attributed to the partner under Vorlen records. VAT, refunds, credits, rebates, chargebacks and sums not retained by Vorlen are excluded from the commission base. No commission is earned merely because a candidate is introduced or an invoice is issued.
4. Attribution. Vorlen's timestamped client, vacancy, candidate and placement records determine attribution. Duplicate or disputed introductions are reviewed by a Vorlen manager. A partner must not create duplicate records to obtain attribution.
5. Client terms. Only authorised Vorlen managers may approve or vary client commercial terms, fees, rebates or contractual commitments.
6. Candidate data. Personal data may be processed only for authorised recruitment purposes, through approved Vorlen systems, with appropriate confidentiality and data-protection safeguards. Candidate data must not be exported, retained privately or reused outside authorised work.
7. Conduct. The partner must act professionally, accurately identify the Vorlen relationship, avoid misleading statements and comply with applicable recruitment, equality, privacy, anti-bribery and marketing rules.
8. Confidentiality and IP. Vorlen/client/candidate confidential information and platform materials remain protected and may be used only for the partnership.
9. Payment. Earned commission is subject to manager approval and is paid using the partner's approved payment details. Any overpayment or commission affected by a later client refund/rebate may be reversed or offset where the underlying fee is no longer retained.
10. Termination. Vorlen may suspend or terminate access for compliance, security, misconduct or commercial reasons. Termination does not create commission on fees not actually received; valid earned commission already due remains recorded.
11. Independent status. The partner is responsible for their own tax, insurance and business obligations in their jurisdiction. Nothing creates employment, worker status, partnership in law or authority to bind Vorlen.
12. Entire operational terms. These terms work with Vorlen privacy/security policies and any written partner schedule issued by Vorlen. Material changes require a new version and acceptance.$terms$
 from missing returning id,company_id,partner_id
)
insert into public.partner_onboarding(partner_id,company_id,status,agreement_id)
select partner_id,company_id,'terms_pending',id from ins;