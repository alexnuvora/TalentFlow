import test from 'node:test';
import assert from 'node:assert/strict';
import {providerConfig,validateReport} from '../supabase/functions/ai-screen-candidate/provider.mjs';
const read = values => name => values[name];
test('configures compatible providers',()=>assert.deepEqual(providerConfig(read({AI_BASE_URL:'https://provider.example/api/v1/',AI_API_KEY:'secret',AI_MODEL:'custom'})),{url:'https://provider.example/api/v1/chat/completions',key:'secret',model:'custom'}));
test('missing credentials or model fail closed',()=> {
  assert.throws(()=>providerConfig(read({})));
  assert.throws(()=>providerConfig(read({AI_API_KEY:'secret'})));
});
test('rejects insecure and credential-bearing URLs',()=> {
  for(const AI_BASE_URL of ['http://provider.example/v1','https://user:pass@example.com','https://example.com?key=secret','https://example.com#x']) assert.throws(()=>providerConfig(read({AI_BASE_URL,AI_API_KEY:'secret',AI_MODEL:'model'})));
});
test('legacy server environment names remain supported',()=>assert.equal(providerConfig(read({OPENAI_API_KEY:'secret',OPENAI_MODEL:'legacy'})).model,'legacy'));
const valid = {score:75,summary:'Job-related evidence',strengths:[],gaps:[],interview_questions:[],evidence:[]};
test('valid reports are allowlisted',()=>assert.deepEqual(validateReport({...valid,stage:'rejected'}),valid));
test('malformed AI output is rejected',()=> {
  for(const value of [{},{...valid,score:'75'},{...valid,score:101},{...valid,evidence:[{}]},{...valid,summary:''}]) assert.throws(()=>validateReport(value));
});
