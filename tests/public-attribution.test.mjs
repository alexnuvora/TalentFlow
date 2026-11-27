import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPublicAttribution,publicSourcePath} from '../src/lib/publicAttribution.mjs';
const origin='https://www.vorlen.co.uk';
test('retains original employer entry through SPA navigation',()=>{
 const first=nextPublicAttribution(null,'/sectors/hgv-driver-recruitment','','https://www.google.co.uk/',origin);
 assert.deepEqual(nextPublicAttribution(first,'/contact','?reason=employer','',origin),{source_page:'/sectors/hgv-driver-recruitment',utm_source:'google-referral',utm_campaign:''});
});
test('preserves explicit campaign across navigation',()=>{
 const first=nextPublicAttribution(null,'/employers','?utm_source=facebook&utm_campaign=employers','',origin);
 assert.deepEqual(nextPublicAttribution(first,'/contact'),{source_page:'/employers',utm_source:'facebook',utm_campaign:'employers'});
});
test('does not record private paths or arbitrary query parameters',()=>{
 assert.equal(nextPublicAttribution(null,'/dashboard/clients/123','?utm_source=secret'),null);
 assert.equal(publicSourcePath('/review/private-token'),'');
 assert.deepEqual(nextPublicAttribution(null,'/contact','?email=test%40example.com&utm_source=test%40example.com'),{source_page:'/contact',utm_source:'',utm_campaign:''});
});
test('direct contact remains unclassified rather than organic',()=>{
 assert.deepEqual(nextPublicAttribution(null,'/contact'),{source_page:'/contact',utm_source:'',utm_campaign:''});
});
test('same-origin fallback keeps only public path',()=>{
 assert.deepEqual(nextPublicAttribution(null,'/contact','','https://www.vorlen.co.uk/tools/recruitment-fee-calculator?foo=bar',origin),{source_page:'/tools/recruitment-fee-calculator',utm_source:'',utm_campaign:''});
});
