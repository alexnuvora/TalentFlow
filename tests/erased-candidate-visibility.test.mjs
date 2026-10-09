import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const page of ['PartnerOperations','PartnerManagement','Interviews']) {
 test(page+' excludes erased candidates from active candidate selectors',()=>{
  const src=readFileSync(new URL('../src/pages/'+page+'.tsx',import.meta.url),'utf8');
  assert.match(src,/from\('candidates'\)\.select\('[^']+'\)\.is\('erased_at',null\)/);
 });
}
test('recruiter talent pool snapshot excludes erased members',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261009171840_hide_erased_candidates_from_partner_talent_pools_20261009.sql',import.meta.url),'utf8');
 assert.match(sql,/join public\.candidates c on c\.id=m\.candidate_id and c\.erased_at is null/);
});
