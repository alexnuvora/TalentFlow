import {analyticsAllowed,analyticsPath,trafficSource} from './siteConsent.mjs';
type EventName='page_view'|'employer_enquiry'|'candidate_application'|'interest_registered';
let source='',lastPage='';
export function resetSiteVisit(){source='';lastPage=''}
export function trackSiteEvent(event:EventName){
 const page=analyticsPath(window.location.pathname);
 if(!page||!analyticsAllowed(window.location.pathname))return;
 if(!source)source=trafficSource(window.location.search,document.referrer);
 void fetch('/api/site-analytics',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,page,source}),keepalive:true}).catch(()=>{});
}
export function trackSitePage(key:string){
 if(!analyticsAllowed(window.location.pathname))return;
 const identity=key+':'+window.location.pathname;
 if(identity===lastPage)return;
 lastPage=identity;
 trackSiteEvent('page_view');
}
