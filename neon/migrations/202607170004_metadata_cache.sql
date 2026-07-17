-- Provider identifiers and raw responses stay behind the trusted catalog API.
-- The browser reads normalized rows from public.media but cannot write provider
-- cache records or inspect raw upstream payloads.

alter table public.media
add column metadata_expires_at timestamptz;

create index media_metadata_refresh_idx
  on public.media (metadata_expires_at)
  where tmdb_id is not null;

create table public.media_provider_ids (
  media_id uuid not null references public.media (id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9-]+$'),
  provider_media_type text not null check (provider_media_type in ('movie', 'tv')),
  provider_id text not null check (provider_id ~ '^[0-9]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_media_type, provider_id),
  unique (media_id, provider)
);
create index media_provider_ids_media_idx
  on public.media_provider_ids (media_id);

create table public.provider_metadata_cache (
  provider text not null check (provider ~ '^[a-z0-9-]+$'),
  resource_type text not null check (resource_type in ('search', 'movie', 'tv', 'season')),
  provider_id text not null,
  locale text not null default 'en-US',
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (provider, resource_type, provider_id, locale),
  check (expires_at > fetched_at)
);
create index provider_metadata_cache_expiry_idx
  on public.provider_metadata_cache (expires_at);

alter table public.media_provider_ids enable row level security;
alter table public.provider_metadata_cache enable row level security;

revoke all on table public.media_provider_ids from public, anonymous, authenticated;
revoke all on table public.provider_metadata_cache from public, anonymous, authenticated;

with provider_seed (local_id, provider_media_type, provider_id) as (
  values
    ('severance', 'tv', 95396::bigint),
    ('dune-part-two', 'movie', 693134::bigint),
    ('past-lives', 'movie', 666277::bigint),
    ('dark', 'tv', 70523::bigint),
    ('the-bear', 'tv', 136315::bigint),
    ('arrival', 'movie', 329865::bigint),
    ('aftersun', 'movie', 965150::bigint),
    ('portrait', 'movie', 531428::bigint),
    ('andor', 'tv', 83867::bigint),
    ('perfect-days', 'movie', 976893::bigint),
    ('poor-things', 'movie', 792307::bigint),
    ('decision-to-leave', 'movie', 705996::bigint),
    ('columbus', 'movie', 414453::bigint),
    ('memories-of-murder', 'movie', 11423::bigint)
)
update public.media as media
set tmdb_id = provider_seed.provider_id
from provider_seed
where media.metadata ->> 'localId' = provider_seed.local_id;

insert into public.media_provider_ids (
  media_id,
  provider,
  provider_media_type,
  provider_id
)
select
  media.id,
  'tmdb',
  case media.format when 'series' then 'tv' else 'movie' end,
  media.tmdb_id::text
from public.media as media
where media.tmdb_id is not null
on conflict (provider, provider_media_type, provider_id) do update
set
  media_id = excluded.media_id,
  updated_at = now();
