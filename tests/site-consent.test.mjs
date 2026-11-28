import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsPath,isPublicPrivacyPage,parseConsent,CONSENT_TTL,trafficSource,validAnalyticsEvent} from '../src/lib/siteConsent.mjs';
const now=1700000000000;
const choice=(analytics=true,savedAt=now,version=1)=>JSON.stringify({version,analytics,savedAt});
test('no decision, corruption, expired or future-dated choice fail closed',()=>{
 for(const raw of [null,'bad',choice(true,now-CONSENT_TTL),choice(true,now+1),choice(true,now,0),JSON.stringify({version:1,analytics:'true',savedAt:now})])assert.equal(parseConsent(raw,now),null);
});
test('reject and accept are both explicit, versioned choices',()=>{
 assert.equal(parseConsent(choice(false),now).analytics,false);
 assert.equal(parseConsent(choice(true),now).analytics,true);
});
test('private URLs, unknown paths and query parameters never become analytics dimensions',()=>{
 for(const path of ['/dashboard','/dashboard/candidates/123','/client','/candidate','/login','/review/secret','/auth/confirm','/contact?email=x','/careers/x%2Fy','/services/unlisted','/r/abc','/privacy'])assert.equal(analyticsPath(path),'');
 assert.equal(analyticsPath('/'),'/');assert.equal(analyticsPath('/careers/hgv-driver'),'/careers/opportunity');assert.equal(analyticsPath('/campaign/hgv-referral'),'/campaign/opportunity');
 assert.equal(isPublicPrivacyPage('/privacy'),true);assert.equal(isPublicPrivacyPage('/dashboard'),false);
});
test('source names are coarse buckets, never raw URLs or user-provided labels',()=>{
 assert.equal(trafficSource('?utm_source=FB',''),'facebook');
 assert.equal(trafficSource('?utm_source=private-label',''),'other');
 assert.equal(trafficSource('','https://www.google.co.uk/search?q=private'),'google');
 assert.equal(trafficSource('','https://www.vorlen.co.uk/contact'),'direct-or-unknown');
 assert.equal(trafficSource('','https://facebook.com.evil.example'),'other');
});
test('server accepts only fixed shape, bounded public page and approved events',()=>{
 const valid={event:'page_view',page:'/about',source:'google'};
 assert.equal(validAnalyticsEvent(valid),true);
 for(const bad of [{...valid,email:'test@example.test'},{...valid,page:'/dashboard'},{...valid,source:'private-value'},{...valid,page:'/careers/raw-job-id'},{...valid,event:'employer_enquiry'},{...valid,event:'candidate_application',page:'/contact'},null,[]])assert.equal(validAnalyticsEvent(bad),false);
 assert.equal(validAnalyticsEvent({event:'employer_enquiry',page:'/contact',source:'direct-or-unknown'}),true);
 assert.equal(validAnalyticsEvent({event:'candidate_application',page:'/careers/opportunity',source:'facebook'}),true);
});
