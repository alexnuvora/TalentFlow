/** Server-only settings; base URL includes the provider API version. */
export function providerConfig(get) {
  const key = get('AI_API_KEY') || get('OPENAI_API_KEY');
  const model = get('AI_MODEL') || get('OPENAI_MODEL');
  const url = new URL(get('AI_BASE_URL') || 'https://api.openai.com/v1');
  if (!key?.trim() || !model?.trim()) throw new Error('AI_API_KEY and AI_MODEL are required');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('AI_BASE_URL must be a clean HTTPS base URL');
  url.pathname = url.pathname.replace(/\/+$/, '') + '/chat/completions';
  return {key, model, url:url.toString()};
}
export function validateReport(value) {
  if (!value || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 8000) throw new Error('Invalid report');
  const result = {score:value.score,summary:value.summary};
  for (const field of ['strengths','gaps','interview_questions','evidence']) {
    if (!Array.isArray(value[field]) || value[field].length > 30 || !value[field].every(v=>typeof v==='string' && v.length <= 4000)) throw new Error('Invalid report list');
    result[field] = value[field];
  }
  return result;
}
