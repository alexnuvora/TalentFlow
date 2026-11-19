// Stable, client-safe public vacancy URLs. Deliberately excludes client/employer names.
export function publicJobSlug(job) {
  const slugPart = (value, fallback, limit) => String(value || fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, limit)
    .replace(/-+$/g, '') || fallback;
  const title = slugPart(job?.title, 'vacancy', 58);
  const location = slugPart(job?.location, '', 28);
  const id = String(job?.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
  return [title, location, id].filter(Boolean).join('-');
}
