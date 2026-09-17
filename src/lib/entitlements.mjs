export function subscriptionActive(s, now = Date.now()) {
 return !!s && (s.status === 'active' || (s.status === 'trialing' && Number.isFinite(Date.parse(s.trial_ends_at)) && Date.parse(s.trial_ends_at) > now));
}
export function hasFeature(s, feature, now = Date.now()) {
 return subscriptionActive(s, now) && s.features?.[feature] === true;
}
export function limitReached(s, resource) {
 const limit=s?.limits?.[resource], used=s?.usage?.[resource];
 return typeof limit==='number' && limit>=0 && Number(used)>=limit;
}
