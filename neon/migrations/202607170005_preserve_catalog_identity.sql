-- Restore and preserve stable local IDs for curated titles if a provider refresh
-- has already enriched their metadata with a full domain payload.

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
), repaired as (
  update public.media as media
  set metadata = case
    when media.metadata ? 'domain' then
      jsonb_set(
        jsonb_set(
          jsonb_set(media.metadata, '{localId}', to_jsonb(provider_seed.local_id), true),
          '{catalog}',
          '"development"'::jsonb,
          true
        ),
        '{domain,id}',
        to_jsonb(provider_seed.local_id),
        true
      )
    else
      jsonb_set(
        jsonb_set(media.metadata, '{localId}', to_jsonb(provider_seed.local_id), true),
        '{catalog}',
        '"development"'::jsonb,
        true
      )
    end
  from provider_seed
  where media.tmdb_id = provider_seed.provider_id
    and media.format::text = case
      when provider_seed.provider_media_type = 'tv' then 'series'
      else 'movie'
    end
  returning media.id, provider_seed.provider_media_type, provider_seed.provider_id
)
insert into public.media_provider_ids (
  media_id,
  provider,
  provider_media_type,
  provider_id
)
select
  repaired.id,
  'tmdb',
  repaired.provider_media_type,
  repaired.provider_id::text
from repaired
on conflict (provider, provider_media_type, provider_id) do update
set media_id = excluded.media_id,
    updated_at = now();
