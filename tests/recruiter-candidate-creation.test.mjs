import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/pages/PartnerClients.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261009160021_atomic_partner_candidate_vacancy_creation_20261009.sql',import.meta.url),'utf8');
test('new recruiter candidate vacancy picker excludes unauthorised research opportunities',()=>{
 assert.match(source,/jobs\.filter\(canSourceForJob\)/);
 assert.match(source,/sourceJob&&!jobs\.some\(j=>j\.id===sourceJob&&canSourceForJob\(j\)\)/);
 assert.match(source,/partner_sourcing_state,sourcing_approved_at/);
});
test('recruiter candidate and vacancy are persisted by one transaction',()=>{
 assert.match(source,/rpc\('source_partner_candidate_for_job'/);
 assert.match(source,/p_job:sourceJob\|\|null/);
 assert.doesNotMatch(source,/from\('partner_candidate_pipeline'\)\.insert/);
 assert.match(migration,/private\.source_partner_candidate_impl/);
 assert.match(migration,/insert into public\.partner_candidate_pipeline/);
});
test('atomic creation checks scope, permissions and records next action',()=>{
 assert.match(migration,/a\.partner_id=v_user/);
 assert.match(migration,/private\.partner_job_sourcing_allowed/);
 assert.match(migration,/next_action/);
 assert.match(migration,/security invoker/);
 assert.match(migration,/grant execute .* to authenticated/);
});
