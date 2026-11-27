// Stable, reversible URL-safe encoding of the existing referral UUID.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function referralCode(id:string):string {
 const hex=id.replace(/-/g,'').toLowerCase();
 if(!/^[0-9a-f]{32}$/.test(hex))throw new Error('Invalid referral ID');
 let bits='';for(const c of hex)bits+=parseInt(c,16).toString(2).padStart(4,'0');
 bits+='0000';let out='';for(let i=0;i<bits.length;i+=6)out+=alphabet[parseInt(bits.slice(i,i+6),2)];return out;
}
export function referralId(code:string):string|null {
 if(!/^[A-Za-z0-9_-]{22}$/.test(code))return null;
 let bits='';for(const c of code)bits+=alphabet.indexOf(c).toString(2).padStart(6,'0');
 if(bits.slice(128)!=='0000')return null;
 let hex='';for(let i=0;i<128;i+=4)hex+=parseInt(bits.slice(i,i+4),2).toString(16);
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export function referralDestination(c:{slug:string},l:{slug:string;source?:string;medium?:string;campaign?:string;content?:string}):string {
 const q=new URLSearchParams({link:l.slug,utm_source:l.source||'referral',utm_medium:l.medium||'referral'});
 q.set('utm_campaign',l.campaign||c.slug||'campaign');if(l.content)q.set('utm_content',l.content);
 return '/campaign/'+encodeURIComponent(c.slug)+'?'+q.toString();
}
