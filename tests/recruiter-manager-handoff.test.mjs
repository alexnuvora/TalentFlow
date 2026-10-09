import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const talent=readFileSync(new URL('../src/pages/PartnerTalentTools.tsx',import.meta.url),'utf8');
const ops=readFileSync(new URL('../src/pages/PartnerOperations.tsx',import.meta.url),'utf8');
test('partner talent loads manager-reviewed candidate-vacancy recommendations',()=>{
 assert.match(talent,/from\('partner_candidate_pipeline'\)\.select\('candidate_id,job_id,stage,manager_status'\)/);
 assert.match(talent,/pipeError/);
 assert.match(talent,/d\.pipeline=pipe\|\|\[\]/);
});
test('submission-pack action is blocked until an approved recommendation for the same pair',()=>{
 assert.match(talent,/p\.job_id===jobId&&p\.candidate_id===candidateId&&p\.stage==='recommended'&&p\.manager_status==='approved'/);
 assert.match(talent,/!approvedRecommendation/);
 assert.match(talent,/if\(!recommendation\)return setError/);
});
test('recruiter recommendation triggers human review rather than client submission',()=>{
 assert.match(ops,/patch\.manager_status='pending'/);
 assert.match(ops,/Candidate recommended to Vorlen for human review/);
});
