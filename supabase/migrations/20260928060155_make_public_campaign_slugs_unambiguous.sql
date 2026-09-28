create unique index if not exists idx_campaigns_public_slug_unique on public.campaigns(slug) where slug is not null;
