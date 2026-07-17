import { neon } from "@neondatabase/serverless";
import type { Media } from "../../src/types";
import type { ProviderMediaType } from "../../src/catalog/search";
import type { TmdbCatalogEntry } from "./tmdb";

interface CachedMediaRow {
  id: string;
  metadata: unknown;
  metadata_expires_at: string | null;
}

interface StoredMetadata {
  localId: string;
  catalog: "tmdb";
  domain: Media;
}

function isMedia(value: unknown): value is Media {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Media>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    (item.format === "movie" || item.format === "series") &&
    typeof item.poster === "string" &&
    typeof item.backdrop === "string" &&
    typeof item.runtime === "number" &&
    Array.isArray(item.genres) &&
    Array.isArray(item.moods) &&
    typeof item.synopsis === "string" &&
    item.provider?.name === "tmdb"
  );
}

function storedMedia(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const domain = (metadata as Partial<StoredMetadata>).domain;
  return isMedia(domain) ? domain : undefined;
}

export function createCatalogDatabase(connectionString: string) {
  const sql = neon(connectionString);

  return {
    async getFreshTmdbTitle(
      mediaType: ProviderMediaType,
      providerId: number,
      now = new Date(),
    ) {
      const format = mediaType === "tv" ? "series" : "movie";
      const rows = await sql`
        select id, metadata, metadata_expires_at
        from public.media
        where format = ${format}::public.media_format
          and tmdb_id = ${providerId}
        limit 1
      `;
      const row = rows[0] as CachedMediaRow | undefined;
      if (
        !row?.metadata_expires_at ||
        new Date(row.metadata_expires_at).getTime() <= now.getTime()
      ) {
        return undefined;
      }
      return storedMedia(row.metadata);
    },

    async saveTmdbTitle(
      entry: TmdbCatalogEntry,
      mediaType: ProviderMediaType,
      providerId: number,
      now = new Date(),
    ) {
      const media = entry.media;
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const metadata: StoredMetadata = {
        localId: media.id,
        catalog: "tmdb",
        domain: media,
      };
      const metadataJson = JSON.stringify(metadata);
      const rows = await sql`
        insert into public.media (
          format,
          tmdb_id,
          title,
          original_title,
          release_year,
          runtime_minutes,
          poster_path,
          backdrop_path,
          metadata,
          metadata_updated_at,
          metadata_expires_at
        )
        values (
          ${media.format}::public.media_format,
          ${providerId},
          ${media.title},
          ${entry.detail.original_title ?? entry.detail.original_name ?? null},
          ${media.year || null},
          ${media.runtime || null},
          ${entry.posterPath ?? null},
          ${entry.backdropPath ?? null},
          ${metadataJson}::jsonb,
          ${now.toISOString()}::timestamptz,
          ${expiresAt.toISOString()}::timestamptz
        )
        on conflict (format, tmdb_id) do update
        set
          title = excluded.title,
          original_title = excluded.original_title,
          release_year = excluded.release_year,
          runtime_minutes = excluded.runtime_minutes,
          poster_path = excluded.poster_path,
          backdrop_path = excluded.backdrop_path,
          metadata = excluded.metadata,
          metadata_updated_at = excluded.metadata_updated_at,
          metadata_expires_at = excluded.metadata_expires_at
        returning id
      `;
      const mediaId = (rows[0] as { id?: string } | undefined)?.id;
      if (!mediaId) throw new Error("The catalog row could not be stored.");

      await sql`
        insert into public.media_provider_ids (
          media_id,
          provider,
          provider_media_type,
          provider_id,
          updated_at
        )
        values (
          ${mediaId}::uuid,
          'tmdb',
          ${mediaType},
          ${String(providerId)},
          ${now.toISOString()}::timestamptz
        )
        on conflict (provider, provider_media_type, provider_id) do update
        set
          media_id = excluded.media_id,
          updated_at = excluded.updated_at
      `;

      const rawPayload = JSON.stringify({
        detail: entry.detail,
        seasons: entry.seasons,
      });
      await sql`
        insert into public.provider_metadata_cache (
          provider,
          resource_type,
          provider_id,
          locale,
          payload,
          fetched_at,
          expires_at
        )
        values (
          'tmdb',
          ${mediaType},
          ${String(providerId)},
          'en-US',
          ${rawPayload}::jsonb,
          ${now.toISOString()}::timestamptz,
          ${expiresAt.toISOString()}::timestamptz
        )
        on conflict (provider, resource_type, provider_id, locale) do update
        set
          payload = excluded.payload,
          fetched_at = excluded.fetched_at,
          expires_at = excluded.expires_at
      `;

      return media;
    },
  };
}
