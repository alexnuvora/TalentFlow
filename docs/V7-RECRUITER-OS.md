# V7 Recruiter Operating System

V7 closes the operational loop between application and client decision.

## Added
- Candidate recruiter workspace (`/candidates/:id`)
- Persistent AI screening reports based on job + application answers
- Human screening call outcomes and notes
- Structured client submission packs
- Client review states: reviewing, approved, rejected, interview requested
- Candidate activity/audit data model
- Next-action fields for follow-up workflow

## Deploy
After V6, run `supabase/v7_recruiter_os.sql`, then redeploy `ai-screen-candidate`.

AI scores are decision support only. A recruiter should review evidence and make the submission decision. Do not use protected/sensitive characteristics in screening criteria.
