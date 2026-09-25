import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('production E2E remains mutation-gated and credential-safe',()=>{
  const support=read('tests/e2e/support.mjs');
  const partner=read('tests/e2e/partner-manager.spec.mjs');
  const portals=read('tests/e2e/portals-security.spec.mjs');
  assert.match(support,/VORLEN_E2E_ALLOW_MUTATIONS/);
  assert.match(support,/cleanupFixture/);
  assert.match(partner,/controlled submission|candidate_submissions/i);
  assert.match(portals,/security boundaries/i);
  assert.doesNotMatch(support,/test1234567|jefferygo0o@gmail\.com/);
  assert.doesNotMatch(partner,/test1234567|jefferygo0o@gmail\.com/);
  assert.doesNotMatch(portals,/test1234567|jefferygo0o@gmail\.com/);
});

test('submission approval creates a controlled official submission draft',()=>{
  const migration=read('supabase/migrations/20260925162000_create_official_submission_on_pack_approval.sql');
  assert.match(migration,/approved_to_send/);
  assert.match(migration,/candidate_submission_id/);
  assert.match(migration,/private\.is_manager\(\)/);
  assert.match(migration,/status<>'withdrawn'/);
});
