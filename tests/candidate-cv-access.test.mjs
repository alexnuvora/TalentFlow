import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const fn=readFileSync(new URL('../supabase/functions/candidate-cv-access/index.ts',import.meta.url),'utf8');
test('CV access requires authenticated user and same-company unerased candidate',()=>{assert.match(fn,/auth\.getUser\(\)/);assert.match(fn,/\.eq\('company_id',p\.company_id\)\.is\('erased_at',null\)/)});
test('partner access requires active candidate assignment and candidate-sourcing role',()=>{assert.match(fn,/\.eq\('partner_id',user\.id\)\.is\('completed_at',null\)/);assert.match(fn,/\['candidate_sourcer','hybrid'\]/);assert.match(fn,/onboarding/);});
test('CV access is audited and uses short-lived signed links',()=>{assert.match(fn,/createSignedUrl\(path,60/);assert.match(fn,/compliance_audit_log/);assert.match(fn,/if\(audit\)/)});
test('CV is available in partner workspace and staff candidate list',()=>{for(const page of ['PartnerCandidateWorkspace','Candidates'])assert.match(readFileSync(new URL('../src/pages/'+page+'.tsx',import.meta.url),'utf8'),/CandidateCvActions/)});

test('original sourcers also qualify and client view blocks erased records',()=>{assert.match(fn,/candidate_source_records/);assert.match(fn,/\.eq\('imported_by',user\.id\)/);const client=readFileSync(new URL('../supabase/functions/client-candidate-cv/index.ts',import.meta.url),'utf8');assert.match(client,/\.is\('erased_at',null\)/);});
