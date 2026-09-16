# UK compliance and launch gate

This is an operational control list, not legal advice. The product supports compliance; the recruitment business must complete the decisions, contracts and records below before accepting live candidates.

## Mandatory launch gate

- Insert the real legal entity name, address and privacy email in deployment environment variables. Placeholder values block release.
- Decide whether each service is an employment agency or employment business and obtain UK advice on the KES self-employed-agent model. Employment status alone does not necessarily remove the Conduct Regulations.
- Execute written terms with each hirer before providing services. Record vacancy identity, role, location, dates, experience/training/qualifications, hazards, expenses and remuneration before advertising or introducing candidates.
- Give work-seekers the privacy notice and terms. Never charge a work-finding fee. Keep optional paid services separate and voluntary.
- Obtain and record authority before sending identifiable candidate details to a client, except for a direct application to that client's clearly identified vacancy.
- Complete a legitimate-interests assessment for ordinary recruitment processing and a DPIA before enabling AI screening at scale. Record suppliers, purpose, evidence, accuracy and bias testing, meaningful human review and challenge routes.
- Execute UK GDPR processor terms; document international-transfer mechanisms and risk assessments where required.
- Register/pay the ICO data-protection fee if applicable and publish the controller's registration number.
- Adopt the retention schedule. The default six-month unsuccessful-candidate review is configurable, not a universal statutory answer.
- Configure a real sending domain, SPF/DKIM/DMARC, Resend and Twilio. Separate application messages from vacancy marketing; record permission and honour opt-outs immediately.
- Operate breach response, data-rights, complaints, supplier, access-review and backup/restore procedures.
- Test reasonable-adjustment requests and an alternative application route. Review adverts and screening questions for direct and indirect discrimination.

## AI recruitment controls

- AI output is advisory. It cannot reject, progress, submit or rank candidates without meaningful human review.
- The prompt must use job-relevant evidence and prohibit protected-trait inference. Recruiters verify evidence rather than rubber-stamp scores.
- Candidates can request an explanation and human reconsideration. Record reviewer, time and outcome in `screening_reports`.
- Do not send CV contents to a model until supplier terms, transfers, retention, regional processing and model data-use settings are confirmed.
- Test accuracy and false-negative rates using lawful, proportionate methods before production and after material changes.

## Conduct Regulations records

For each introduction/placement retain hirer terms, work-seeker terms, authority to submit, role information, identity/suitability checks, communications, outcome, fee basis and complaints or suitability concerns. The audit log assists but does not replace procedures.

## Security controls

- Keep service-role, AI, Twilio, Resend and scheduler secrets server-side only.
- Use a long random `AUTOMATION_CRON_SECRET`; the queue fails closed if it is absent.
- Restrict account creation to administrators, require MFA for privileged users and remove access promptly.
- Keep CV storage private. Add malware scanning/quarantine before downloads in a high-volume live service.
- Restrict production origins for Edge Functions and set hosting security headers.
- Run migrations on staging, test isolation with two tenants and a client viewer, then promote through a recorded change process.

## Primary guidance checked (16 September 2026)

- GOV.UK Conduct Regulations guidance: https://www.gov.uk/government/publications/conduct-regulations-2003-guidance-for-employment-agencies-and-employment-businesses/overview-of-the-conduct-regulations-2003
- Conduct Regulations text: https://www.legislation.gov.uk/uksi/2003/3319/contents
- ICO recruitment and selection: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/
- ICO electronic mail marketing: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/
- GOV.UK discrimination in recruitment: https://www.gov.uk/employer-preventing-discrimination/recruitment
- ACAS reasonable adjustments: https://www.acas.org.uk/recruitment/follow-discrimination-law

## Release status

- **Build verified**: dependency install, security audit and production compilation pass.
- **Deployment verified**: migrations/functions are applied to staging and browser/API/database journeys pass.
- **Production ready**: deployment verified and every mandatory launch item has an owner and evidence.

V8 is build verified. It is not deployment verified until connected to the real Supabase and hosting projects.
