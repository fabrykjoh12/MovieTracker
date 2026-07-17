import type { Media, MediaFormat } from "../types";

export type ProviderMediaType = "movie" | "tv";

export interface MediaSearchResult {
  provider: "tmdb";
  providerId: number;
  mediaType: ProviderMediaType;
  format: MediaFormat;
  title: string;
  originalTitle?: string;
  year?: number;
  synopsis: string;
  poster?: string;
  backdrop?: string;
}

export interface CatalogSearchResponse {
  results: MediaSearchResult[];
  source: "edge-cache" | "tmdb";
}

export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogApiError";
  }
}

interface CatalogClientOptions {
  baseUrl: string;
  request?: typeof fetch;
}

export interface CatalogSearchClient {
  search(
    query: string,
    format?: "any" | MediaFormat,
    signal?: AbortSignal,
  ): Promise<CatalogSearchResponse>;
  importTitle(result: MediaSearchResult, signal?: AbortSignal): Promise<Media>;
}

function apiMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function isSearchResult(value: unknown): value is MediaSearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<MediaSearchResult>;
  return (
    result.provider === "tmdb" &&
    typeof result.providerId === "number" &&
    (result.mediaType === "movie" || result.mediaType === "tv") &&
    (result.format === "movie" || result.format === "series") &&
    typeof result.title === "string" &&
    typeof result.synopsis === "string"
  );
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
    typeof item.synopsis === "string" &&
    item.provider?.name === "tmdb"
  );
}

async function readPayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

export function createCatalogSearchClient({
  baseUrl,
  request = fetch,
}: CatalogClientOptions): CatalogSearchClient {
  const root = baseUrl.replace(/\/+$/, "");

  return {
    async search(query, format = "any", signal) {
      const url = new URL(`${root}/v1/search`);
      url.searchParams.set("q", query.trim());
      if (format !== "any") url.searchParams.set("format", format);
      const response = await request(url, {
        headers: { Accept: "application/json" },
        signal,
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new CatalogApiError(
          apiMessage(payload, "Catalog search is temporarily unavailable."),
          response.status,
        );
      }
      if (!payload || typeof payload !== "object" || !("results" in payload)) {
        throw new CatalogApiError(
          "The catalog returned an invalid response.",
          502,
        );
      }
      const results = Array.isArray(payload.results)
        ? payload.results.filter(isSearchResult)
        : [];
      return {
        results,
        source:
          "source" in payload && payload.source === "edge-cache"
            ? "edge-cache"
            : "tmdb",
      };
    },

    async importTitle(result, signal) {
      const response = await request(`${root}/v1/catalog`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: result.provider,
          providerId: result.providerId,
          mediaType: result.mediaType,
        }),
        signal,
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new CatalogApiError(
          apiMessage(payload, "This title could not be added right now."),
          response.status,
        );
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("media" in payload) ||
        !isMedia(payload.media)
      ) {
        throw new CatalogApiError(
          "The catalog returned an invalid title.",
          502,
        );
      }
      return payload.media;
    },
  };
}

const configuredCatalogApiUrl = import.meta.env.VITE_CATALOG_API_URL?.trim();

export const isCatalogSearchConfigured = Boolean(configuredCatalogApiUrl);

export function getCatalogSearchClient() {
  return configuredCatalogApiUrl
    ? createCatalogSearchClient({ baseUrl: configuredCatalogApiUrl })
    : null;
}
