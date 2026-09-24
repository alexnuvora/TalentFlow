alter table public.partner_profiles
  add column if not exists display_name text,
  add column if not exists linkedin_url text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists sectors text[] not null default '{}',
  add column if not exists regions text[] not null default '{}',
  add column if not exists role_types text[] not null default '{}',
  add column if not exists availability_hours text,
  add column if not exists profile_photo_url text;
