-- Invite-only onboarding hardening.
-- Prevent direct workspace creation through the legacy onboarding RPC.
revoke execute on function public.onboard_recruitment_company from public;
revoke execute on function public.onboard_recruitment_company from anon;
revoke execute on function public.onboard_recruitment_company from authenticated;
