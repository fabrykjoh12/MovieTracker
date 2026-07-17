import type {
  MediaSearchResult,
  ProviderMediaType,
} from "../../src/catalog/search";
import type { Episode, Media, Season } from "../../src/types";

const tmdbApiRoot = "https://api.themoviedb.org/3";
const tmdbImageRoot = "https://image.tmdb.org/t/p";
const accentPalette = [
  "#9d7259",
  "#6f8790",
  "#7e8061",
  "#866f82",
  "#8b7453",
] as const;

interface TmdbSearchItem {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  adult?: boolean;
}

interface TmdbSearchPayload {
  results?: TmdbSearchItem[];
}

interface TmdbGenre {
  id?: number;
  name?: string;
}

interface TmdbPerson {
  name?: string;
  job?: string;
}

interface TmdbWatchProvider {
  provider_name?: string;
}

interface TmdbWatchRegion {
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

interface TmdbDetail {
  id?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: TmdbGenre[];
  created_by?: TmdbPerson[];
  credits?: {
    cast?: TmdbPerson[];
    crew?: TmdbPerson[];
  };
  production_countries?: Array<{ name?: string }>;
  spoken_languages?: Array<{ english_name?: string; name?: string }>;
  original_language?: string;
  seasons?: Array<{
    season_number?: number;
    name?: string;
    air_date?: string | null;
  }>;
  "watch/providers"?: { results?: Record<string, TmdbWatchRegion> };
}

interface TmdbSeasonDetail {
  season_number?: number;
  name?: string;
  air_date?: string | null;
  episodes?: Array<{
    id?: number;
    episode_number?: number;
    name?: string;
    runtime?: number | null;
    overview?: string;
  }>;
}

export interface TmdbCatalogEntry {
  media: Media;
  detail: TmdbDetail;
  seasons: TmdbSeasonDetail[];
  posterPath?: string;
  backdropPath?: string;
}

export class TmdbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TmdbApiError";
  }
}

function year(value?: string | null) {
  if (!value) return undefined;
  const parsed = Number(value.slice(0, 4));
  return Number.isInteger(parsed) && parsed >= 1870 && parsed <= 2200
    ? parsed
    : undefined;
}

function imageUrl(path: string | null | undefined, size: "w500" | "w1280") {
  return path ? `${tmdbImageRoot}/${size}${path}` : undefined;
}

function fallbackArtwork(title: string, orientation: "poster" | "backdrop") {
  const width = orientation === "poster" ? 600 : 1200;
  const height = orientation === "poster" ? 900 : 675;
  const safeTitle = title.replace(/[<>&"']/g, "").slice(0, 48);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#171816"/><circle cx="${width * 0.74}" cy="${height * 0.25}" r="${width * 0.28}" fill="#34342e"/><path d="M0 ${height * 0.78} L${width * 0.58} ${height * 0.35} L${width} ${height * 0.76} V${height} H0Z" fill="#242621"/><text x="${width * 0.08}" y="${height * 0.86}" fill="#eee8dc" font-family="Georgia,serif" font-size="${orientation === "poster" ? 34 : 46}">${safeTitle}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function displayTitle(item: TmdbSearchItem | TmdbDetail) {
  return item.title?.trim() || item.name?.trim() || "Untitled";
}

function originalTitle(item: TmdbSearchItem | TmdbDetail) {
  const value = item.original_title?.trim() || item.original_name?.trim();
  return value && value !== displayTitle(item) ? value : undefined;
}

function uniqueNames(values: Array<string | undefined>, limit = 6) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).slice(0, limit);
}

async function tmdbRequest<T>(
  token: string,
  path: string,
  params: Record<string, string> = {},
  request: typeof fetch = fetch,
) {
  const url = new URL(`${tmdbApiRoot}${path}`);
  Object.entries({ language: "en-US", ...params }).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const response = await request(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new TmdbApiError(
      response.status === 404
        ? "TMDB could not find that title."
        : "TMDB is temporarily unavailable.",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function searchTmdb(
  token: string,
  query: string,
  format: "any" | "movie" | "series" = "any",
  request: typeof fetch = fetch,
): Promise<MediaSearchResult[]> {
  const payload = await tmdbRequest<TmdbSearchPayload>(
    token,
    "/search/multi",
    { query, include_adult: "false", page: "1" },
    request,
  );
  return (payload.results ?? [])
    .filter(
      (
        item,
      ): item is TmdbSearchItem & {
        id: number;
        media_type: ProviderMediaType;
      } =>
        typeof item.id === "number" &&
        (item.media_type === "movie" || item.media_type === "tv") &&
        !item.adult,
    )
    .filter(
      (item) =>
        format === "any" ||
        (format === "movie" && item.media_type === "movie") ||
        (format === "series" && item.media_type === "tv"),
    )
    .slice(0, 12)
    .map((item) => ({
      provider: "tmdb" as const,
      providerId: item.id,
      mediaType: item.media_type,
      format:
        item.media_type === "tv" ? ("series" as const) : ("movie" as const),
      title: displayTitle(item),
      ...(originalTitle(item) ? { originalTitle: originalTitle(item) } : {}),
      ...(year(item.release_date ?? item.first_air_date)
        ? { year: year(item.release_date ?? item.first_air_date) }
        : {}),
      synopsis: item.overview?.trim() || "Synopsis unavailable from TMDB.",
      ...(imageUrl(item.poster_path, "w500")
        ? { poster: imageUrl(item.poster_path, "w500") }
        : {}),
      ...(imageUrl(item.backdrop_path, "w1280")
        ? { backdrop: imageUrl(item.backdrop_path, "w1280") }
        : {}),
    }));
}

function mapEpisode(
  item: NonNullable<TmdbSeasonDetail["episodes"]>[number],
  seasonNumber: number,
): Episode | undefined {
  if (!item.episode_number || item.episode_number < 1) return undefined;
  return {
    id: item.id
      ? `tmdb-episode-${item.id}`
      : `s${seasonNumber}e${item.episode_number}`,
    number: item.episode_number,
    title: item.name?.trim() || `Episode ${item.episode_number}`,
    runtime: item.runtime && item.runtime > 0 ? item.runtime : 0,
    synopsis: item.overview?.trim() || "Episode synopsis unavailable.",
  };
}

function mapSeason(item: TmdbSeasonDetail): Season | undefined {
  const number = item.season_number;
  if (!number || number < 1) return undefined;
  const releaseYear = year(item.air_date) ?? 0;
  return {
    number,
    ...(item.name?.trim() ? { title: item.name.trim() } : {}),
    year: releaseYear,
    episodes: (item.episodes ?? []).flatMap((episode) => {
      const mapped = mapEpisode(episode, number);
      return mapped ? [mapped] : [];
    }),
  };
}

export async function fetchTmdbCatalogEntry(
  token: string,
  mediaType: ProviderMediaType,
  providerId: number,
  request: typeof fetch = fetch,
): Promise<TmdbCatalogEntry> {
  const detail = await tmdbRequest<TmdbDetail>(
    token,
    `/${mediaType}/${providerId}`,
    { append_to_response: "credits,watch/providers" },
    request,
  );
  if (detail.id !== providerId) {
    throw new TmdbApiError("TMDB returned an unexpected title.", 502);
  }

  const seasonStubs =
    mediaType === "tv"
      ? (detail.seasons ?? [])
          .filter((season) => (season.season_number ?? 0) > 0)
          .sort(
            (left, right) =>
              (left.season_number ?? 0) - (right.season_number ?? 0),
          )
          .slice(0, 20)
      : [];
  const seasonDetails = await Promise.all(
    seasonStubs.map((season) =>
      tmdbRequest<TmdbSeasonDetail>(
        token,
        `/tv/${providerId}/season/${season.season_number}`,
        {},
        request,
      ),
    ),
  );

  const title = displayTitle(detail);
  const genres = uniqueNames((detail.genres ?? []).map((genre) => genre.name));
  const crew = detail.credits?.crew ?? [];
  const creators =
    mediaType === "movie"
      ? uniqueNames(
          crew
            .filter(
              (person) => person.job === "Director" || person.job === "Writer",
            )
            .map((person) => person.name),
          4,
        )
      : uniqueNames(
          (detail.created_by ?? []).map((person) => person.name),
          4,
        );
  const cast = uniqueNames(
    (detail.credits?.cast ?? []).map((person) => person.name),
    6,
  );
  const norwegianProviders = detail["watch/providers"]?.results?.NO;
  const services = uniqueNames(
    [
      ...(norwegianProviders?.flatrate ?? []),
      ...(norwegianProviders?.rent ?? []),
      ...(norwegianProviders?.buy ?? []),
    ].map((provider) => provider.provider_name),
    8,
  );
  const runtime =
    mediaType === "movie"
      ? detail.runtime && detail.runtime > 0
        ? detail.runtime
        : 0
      : (detail.episode_run_time?.find((value) => value > 0) ?? 0);
  const itemYear = year(detail.release_date ?? detail.first_air_date) ?? 0;
  const paletteIndex = Math.abs(providerId) % accentPalette.length;
  const poster =
    imageUrl(detail.poster_path, "w500") ?? fallbackArtwork(title, "poster");
  const backdrop =
    imageUrl(detail.backdrop_path, "w1280") ??
    fallbackArtwork(title, "backdrop");

  return {
    media: {
      id: `tmdb-${mediaType}-${providerId}`,
      title,
      year: itemYear,
      format: mediaType === "tv" ? "series" : "movie",
      poster,
      backdrop,
      accent: accentPalette[paletteIndex] ?? accentPalette[0],
      runtime,
      ...(mediaType === "tv"
        ? {
            seasons: seasonDetails.flatMap((season) => {
              const mapped = mapSeason(season);
              return mapped ? [mapped] : [];
            }),
          }
        : {}),
      genres,
      moods: genres.slice(0, 3),
      pace: "balanced",
      intensity: "balanced",
      adventurous: 5,
      synopsis: detail.overview?.trim() || "Synopsis unavailable from TMDB.",
      creators,
      cast,
      services,
      country:
        detail.production_countries?.find((country) => country.name)?.name ??
        "Country unavailable",
      language:
        detail.spoken_languages?.find(
          (language) => language.english_name || language.name,
        )?.english_name ??
        detail.spoken_languages?.find(
          (language) => language.english_name || language.name,
        )?.name ??
        detail.original_language?.toUpperCase() ??
        "Language unavailable",
      ...(services.length
        ? { availabilityNote: "Availability shown for Norway" }
        : {}),
      provider: { name: "tmdb", id: providerId, mediaType },
    },
    detail,
    seasons: seasonDetails,
    ...(detail.poster_path ? { posterPath: detail.poster_path } : {}),
    ...(detail.backdrop_path ? { backdropPath: detail.backdrop_path } : {}),
  };
}
