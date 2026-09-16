import { supabase } from './supabase';
export async function getDashboard() {
  const [jobs,candidates,clients,apps] = await Promise.all([
    supabase.from('jobs').select('*').order('created_at',{ascending:false}),
    supabase.from('candidates').select('*').order('created_at',{ascending:false}),
    supabase.from('clients').select('*').order('created_at',{ascending:false}),
    supabase.from('applications').select('*').order('submitted_at',{ascending:false})
  ]);
  for (const r of [jobs,candidates,clients,apps]) if (r.error) throw r.error;
  return {jobs:jobs.data||[], candidates:candidates.data||[], clients:clients.data||[], applications:apps.data||[]};
}
export async function signIn(email:string,password:string){ return supabase.auth.signInWithPassword({email,password}); }
export async function signOut(){ return supabase.auth.signOut(); }
export async function updateCandidateStage(id:string, stage:string){ return supabase.from('candidates').update({stage}).eq('id',id); }
export async function createJob(payload:Record<string,unknown>){ return supabase.from('jobs').insert(payload).select().single(); }
export async function createClient(payload:Record<string,unknown>){ return supabase.from('clients').insert(payload).select().single(); }
