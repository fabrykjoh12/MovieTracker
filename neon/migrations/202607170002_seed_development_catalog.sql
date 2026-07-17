-- Stable development catalog used by the local demo and the first Neon-backed
-- library slice. Provider IDs remain nullable until the trusted metadata
-- adapter is added; localId is the explicit bridge to the current domain IDs.

insert into public.media (
  id,
  format,
  title,
  release_year,
  runtime_minutes,
  metadata,
  metadata_updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'series',
    'Severance',
    2022,
    52,
    '{"localId":"severance","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'movie',
    'Dune: Part Two',
    2024,
    166,
    '{"localId":"dune-part-two","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'movie',
    'Past Lives',
    2023,
    106,
    '{"localId":"past-lives","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'series',
    'Dark',
    2017,
    56,
    '{"localId":"dark","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'series',
    'The Bear',
    2022,
    34,
    '{"localId":"the-bear","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'movie',
    'Arrival',
    2016,
    116,
    '{"localId":"arrival","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'movie',
    'Aftersun',
    2022,
    102,
    '{"localId":"aftersun","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'movie',
    'Portrait of a Lady on Fire',
    2019,
    122,
    '{"localId":"portrait","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    'series',
    'Andor',
    2022,
    44,
    '{"localId":"andor","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000010',
    'movie',
    'Perfect Days',
    2023,
    124,
    '{"localId":"perfect-days","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000011',
    'movie',
    'Poor Things',
    2023,
    141,
    '{"localId":"poor-things","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    'movie',
    'Decision to Leave',
    2022,
    138,
    '{"localId":"decision-to-leave","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000013',
    'movie',
    'Columbus',
    2017,
    104,
    '{"localId":"columbus","catalog":"development"}'::jsonb,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000014',
    'movie',
    'Memories of Murder',
    2003,
    131,
    '{"localId":"memories-of-murder","catalog":"development"}'::jsonb,
    now()
  )
on conflict (id) do update
set
  format = excluded.format,
  title = excluded.title,
  release_year = excluded.release_year,
  runtime_minutes = excluded.runtime_minutes,
  metadata = excluded.metadata,
  metadata_updated_at = excluded.metadata_updated_at;
