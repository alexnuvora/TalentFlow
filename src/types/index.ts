export type Role = 'owner'|'recruiter'|'manager'|'viewer';
export type JobStatus = 'draft'|'published'|'paused'|'closed';
export type CandidateStage = 'new'|'screening'|'qualified'|'submitted'|'interview'|'offer'|'placed'|'rejected'|'withdrawn';
export type ClientStatus = 'prospect'|'active'|'paused'|'closed';

export interface Profile { id:string; full_name:string|null; role:Role; company_id:string; }
export interface Job { id:string; client_id:string; title:string; slug:string; description:string; employment_type:string; location:string; salary_min:number|null; salary_max:number|null; commission_text:string|null; status:JobStatus; requirements:string[]; created_at:string; }
export interface Candidate { id:string; full_name:string; email:string; phone:string|null; location:string|null; linkedin_url:string|null; cv_url:string|null; source:string|null; stage:CandidateStage; score:number|null; notes:string|null; consent_at:string|null; created_at:string; }
export interface Client { id:string; company_name:string; contact_name:string; email:string; phone:string|null; status:ClientStatus; website:string|null; created_at:string; }
export interface Application { id:string; job_id:string; candidate_id:string; cover_note:string|null; answers:Record<string,unknown>; status:string; submitted_at:string; }
