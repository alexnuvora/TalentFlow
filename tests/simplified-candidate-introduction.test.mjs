import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workspace=readFileSync(new URL('../src/pages/RecruiterWorkspace.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../supabase/functions/submit-candidate-to-client/index.ts',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../src/pages/CandidateIntroductionEvidence.tsx',import.meta.url),'utf8');
test('CEO introduction uses one readiness-checked send action, not four repeated evidence fields',()=>{
 assert.match(workspace,/Introduce candidate to client/);
 assert.match(workspace,/action:'readiness'/);
 assert.match(workspace,/action:'send_approved'/);
 assert.match(workspace,/!introduction\?\.ready/);
 assert.doesNotMatch(workspace,/<label className="full">Recruiter summary/);
 assert.doesNotMatch(workspace,/<label className="full">Candidate sharing authorisation/);
 assert.doesNotMatch(workspace,/<label className="full">Vacancy particulars \+ willingness evidence/);
 assert.doesNotMatch(workspace,/<label className="full">Suitability check evidence/);
});
test('server verifies approved pack, genuine authority, consent evidence and remaining human review',()=>{
 assert.match(server,/partner_submission_packs/);
 assert.match(server,/status','approved'/);
 assert.match(server,/candidate_sharing_authorisation/);
 assert.match(server,/Candidate permission to share their details/);
 assert.match(server,/AI screening report still needs human review/);
 assert.match(server,/candidate willingness for this vacancy/i);
 assert.match(server,/if\(blockers\.length\)return json/);
 assert.match(server,/repair_unsent_approved_candidate_delivery/);
});
test('missing evidence is handled separately and never automatically submitted',()=>{
 assert.match(workspace,/Resolve missing candidate evidence/);
 assert.match(evidence,/record_candidate_sharing_authority/);
 assert.match(evidence,/record_introduction_compliance/);
 assert.doesNotMatch(evidence,/submit-candidate-to-client/);
});
