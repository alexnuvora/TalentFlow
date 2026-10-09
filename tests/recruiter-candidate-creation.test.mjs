import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/pages/PartnerClients.tsx',import.meta.url),'utf8');
test('new recruiter candidate vacancy picker excludes unauthorised research opportunities',()=>{
  assert.match(source,/jobs\.filter\(canSourceForJob\)/);
  assert.match(source,/sourceJob&&!jobs\.some\(j=>j\.id===sourceJob&&canSourceForJob\(j\)\)/);
});
test('creation verifies persisted candidate-vacancy pair before reporting success',()=>{
  assert.match(source,/from\('partner_candidate_pipeline'\)\.insert/);
  assert.match(source,/\.select\('id,candidate_id,job_id'\)\.single\(\)/);
  assert.match(source,/linked\.candidate_id!==candidateId\|\|linked\.job_id!==sourceJob/);
  assert.match(source,/Candidate created, but vacancy assignment is incomplete/);
});
test('candidate sourcing next step is recorded when vacancy attached',()=>{
  assert.match(source,/next_action:'Screen candidate and confirm work-seeker terms'/);
});
