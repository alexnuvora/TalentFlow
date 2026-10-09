import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const operations=readFileSync(new URL('../src/pages/PartnerOperations.tsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/pages/PartnerCandidateWorkspace.tsx',import.meta.url),'utf8');

test('recruiter assignment binds an actual candidate and job',()=>{
  assert.match(operations,/!newPipeline\.candidate_id\|\|!newPipeline\.job_id/);
  assert.match(operations,/canSourceForJob\(job\)/);
  assert.match(operations,/candidate_id:newPipeline\.candidate_id,job_id:newPipeline\.job_id,stage:'sourced'/);
});
test('assignment never reports success without persisted returned identifiers',()=>{
  assert.match(operations,/\.select\('id,candidate_id,job_id,stage'\)\.single\(\)/);
  assert.match(operations,/created\.job_id!==newPipeline\.job_id/);
  assert.match(operations,/created\.candidate_id!==newPipeline\.candidate_id/);
  assert.match(operations,/if\(e2\|\|!created/);
});
test('existing candidate-vacancy pairing is handled before insert',()=>{
  assert.match(operations,/pipeline\.some\(p=>p\.candidate_id===newPipeline\.candidate_id&&p\.job_id===newPipeline\.job_id\)/);
});
test('manager review and necessary candidate evidence precede recommendation',()=>{
  assert.match(operations,/stage==='recommended'&&!cand\?\.work_seeker_terms_agreed_at/);
  assert.match(operations,/stage==='recommended'&&!cand\?\.resume_path/);
  assert.match(operations,/patch\.manager_status='pending'/);
});
test('unlinked candidates receive actionable navigation rather than false success',()=>{
  assert.match(workspace,/No vacancy linked yet/);
  assert.match(workspace,/Link to an assigned vacancy/);
  assert.match(workspace,/What happens next\?/);
});
