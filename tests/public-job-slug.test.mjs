import test from 'node:test';
import assert from 'node:assert/strict';
import {publicJobSlug} from '../src/lib/publicJobSlug.mjs';

test('public vacancy slug uses role, location and stable id without employer name',()=>{
  const slug=publicJobSlug({id:'12345678-abcd-ef00',title:'Dual Fuel Heating Engineer',location:'Brierfield',slug:'dual-fuel-heating-engineer-alliant'});
  assert.equal(slug,'dual-fuel-heating-engineer-brierfield-12345678');
  assert.doesNotMatch(slug,/alliant/i);
});
test('public vacancy slug is deterministic and safe for missing location',()=>{
  const job={id:'ABCD-1234',title:'Senior Administrator',location:''};
  assert.equal(publicJobSlug(job),'senior-administrator-abcd1234');
  assert.equal(publicJobSlug(job),publicJobSlug(job));
});
test('public vacancy slug normalises accents and punctuation',()=>{
  assert.equal(publicJobSlug({id:'12345678',title:'Café & Finance Lead',location:'Greater Manchester'}),'cafe-finance-lead-greater-manchester-12345678');
});
