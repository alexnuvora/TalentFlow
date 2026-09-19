# Pakistan recruiter onboarding gate

Do not enable a recruiter account's live candidate-data access until every required item below has evidence.

## Identity and commercial
- Verified legal name and contact details.
- Video interview completed; spoken English and recruitment capability assessed.
- Independent-contractor / Recruitment Partner Agreement signed.
- Commission percentage, attribution, payment timing, rebate/clawback and termination terms completed.
- Partner told in writing they cannot charge candidates for work-finding.

## Data protection
- Controller/processor roles mapped for the actual operating model.
- Candidate data flow mapped: UK/Supabase → Pakistan recruiter → authorised UK client.
- Applicable UK international-transfer mechanism selected and executed.
- Where appropriate safeguards are relied on, data protection test / TRA completed and recorded.
- Security measures recorded: least privilege, private CV storage, short-lived download links, MFA where available, no personal-drive exports, incident reporting, offboarding/deletion.
- Candidate privacy notice accurately describes overseas recruiter access.
- DPIA covers AI screening and overseas recruiter workflow where high-risk processing applies.

## Vorlen access
- Create the user with role `recruiter`.
- Insert a valid row in `recruiter_data_access_approvals` only after the evidence above is complete.
- Set `country_code='PK'`.
- Record the actual `transfer_mechanism`; do not use a placeholder.
- Record `agreement_signed_at`, `approved_by`, and the data-protection-test date where required.
- Prefer an expiry/review date so access is periodically re-approved.
- Revoke immediately when the engagement ends or if an incident occurs.

## Operational boundaries
- Recruiters prospect and source; they do not bind Vorlen to client terms unless explicitly authorised.
- Client pricing/contracts/invoicing remain controlled by Vorlen.
- Candidate submissions use the authorised workflow.
- AI screening requires meaningful human review.
- Recruitment activity is recorded in Vorlen for audit and commission attribution.
