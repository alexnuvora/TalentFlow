-- Allow authenticated staff to invoke the screening sign-off RPC.
-- The SECURITY DEFINER function itself requires active candidate-data access,
-- candidate-processing activation, and tenant-scoped matching report.
GRANT EXECUTE ON FUNCTION public.signoff_screening_report(uuid) TO authenticated;
