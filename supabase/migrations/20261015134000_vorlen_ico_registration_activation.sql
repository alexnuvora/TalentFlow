-- Vorlen Ltd: ICO payment confirmed 15 October 2026 (reference ZC275029).
-- The previous pre-trading self-assessment is superseded, not retrospectively erased.
-- Public ICO directory publication and certificate verification are separate events.
UPDATE public.companies
SET ico_status='registered',
    ico_registration_number='ZC275029',
    operating_phase='candidate_operations',
    candidate_test_mode_until=NULL,
    ico_assessment_reason='registration_payment_confirmed',
    ico_assessment_notes='ICO payment confirmation received for Vorlen Ltd; reference ZC275029. Public register publication and certificate pending. Previous September 2026 pre-trading fee assessment superseded by registration payment confirmation.',
    ico_reassessment_trigger=NULL,
    ico_reassessment_required_at=NULL,
    compliance_updated_at=now()
WHERE id='dfd61e8c-c03a-4b94-aa7f-a739ee20e64f'
  AND ico_status='not_currently_required'
  AND operating_phase='pre_trading';
