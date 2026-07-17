import type {
  CatalogSearchResponse,
  ProviderMediaType,
} from "../../src/catalog/search";
import { createCatalogDatabase } from "./catalog";
import { fetchTmdbCatalogEntry, searchTmdb, TmdbApiError } from "./tmdb";

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
  DATABASE_URL: string;
  ALLOWED_ORIGINS: string;
  SEARCH_RATE_LIMITER: RateLimitBinding;
  IMPORT_RATE_LIMITER: RateLimitBinding;
}

interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

function allowedOrigins(env: Env) {
  return new Set(
    env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  return origin && allowedOrigins(env).has(origin) ? origin : undefined;
}

function responseHeaders(request: Request, env: Env) {
  const origin = corsOrigin(request, env);
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : {}),
  };
}

function json(
  request: Request,
  env: Env,
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...responseHeaders(request, env), ...headers },
  });
}

function errorResponse(
  request: Request,
  env: Env,
  status: number,
  code: string,
  message: string,
  requestId: string,
) {
  return json(
    request,
    env,
    { error: { code, message, requestId } } satisfies ErrorBody,
    status,
  );
}

function requestKey(request: Request, route: string) {
  const client = request.headers.get("CF-Connecting-IP") ?? "local";
  return `${route}:${client}`;
}

function validProviderId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < 10_000_000_000
  );
}

async function search(
  request: Request,
  env: Env,
  context: ExecutionContext,
  requestId: string,
) {
  const rate = await env.SEARCH_RATE_LIMITER.limit({
    key: requestKey(request, "search"),
  });
  if (!rate.success) {
    return errorResponse(
      request,
      env,
      429,
      "rate_limited",
      "Too many searches. Wait a moment and try again.",
      requestId,
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  const format = url.searchParams.get("format") ?? "any";
  if (query.length < 2 || query.length > 80) {
    return errorResponse(
      request,
      env,
      400,
      "invalid_query",
      "Search with 2 to 80 characters.",
      requestId,
    );
  }
  if (format !== "any" && format !== "movie" && format !== "series") {
    return errorResponse(
      request,
      env,
      400,
      "invalid_format",
      "Choose movies, series, or all titles.",
      requestId,
    );
  }

  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set("q", query.toLocaleLowerCase("en-US"));
  cacheUrl.searchParams.set("format", format);
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const cachedPayload = (await cached.json()) as CatalogSearchResponse;
    return json(request, env, { ...cachedPayload, source: "edge-cache" });
  }

  const results = await searchTmdb(env.TMDB_READ_ACCESS_TOKEN, query, format);
  const payload: CatalogSearchResponse = { results, source: "tmdb" };
  const cacheResponse = new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
  context.waitUntil(edgeCache.put(cacheKey, cacheResponse));
  return json(request, env, payload);
}

async function importTitle(request: Request, env: Env, requestId: string) {
  const rate = await env.IMPORT_RATE_LIMITER.limit({
    key: requestKey(request, "catalog"),
  });
  if (!rate.success) {
    return errorResponse(
      request,
      env,
      429,
      "rate_limited",
      "Too many additions. Wait a moment and try again.",
      requestId,
    );
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 1024) {
    return errorResponse(
      request,
      env,
      413,
      "request_too_large",
      "The catalog request is too large.",
      requestId,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      request,
      env,
      400,
      "invalid_json",
      "Send a valid catalog request.",
      requestId,
    );
  }
  const input = body as {
    provider?: unknown;
    providerId?: unknown;
    mediaType?: unknown;
  };
  if (
    input.provider !== "tmdb" ||
    !validProviderId(input.providerId) ||
    (input.mediaType !== "movie" && input.mediaType !== "tv")
  ) {
    return errorResponse(
      request,
      env,
      400,
      "invalid_title",
      "Choose a valid TMDB movie or series.",
      requestId,
    );
  }

  const mediaType = input.mediaType as ProviderMediaType;
  const providerId = input.providerId;
  const database = createCatalogDatabase(env.DATABASE_URL);
  const cached = await database.getFreshTmdbTitle(mediaType, providerId);
  if (cached)
    return json(request, env, { media: cached, source: "neon-cache" });

  const entry = await fetchTmdbCatalogEntry(
    env.TMDB_READ_ACCESS_TOKEN,
    mediaType,
    providerId,
  );
  const media = await database.saveTmdbTitle(entry, mediaType, providerId);
  return json(request, env, { media, source: "tmdb" }, 201);
}

export async function handleRequest(
  request: Request,
  env: Env,
  context: ExecutionContext,
) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (!corsOrigin(request, env)) {
      return errorResponse(
        request,
        env,
        403,
        "origin_not_allowed",
        "This site is not allowed to use the catalog.",
        requestId,
      );
    }
    return new Response(null, {
      status: 204,
      headers: responseHeaders(request, env),
    });
  }
  if (url.pathname === "/health" && request.method === "GET") {
    return json(request, env, { status: "ok" });
  }
  if (!corsOrigin(request, env)) {
    return errorResponse(
      request,
      env,
      403,
      "origin_not_allowed",
      "This site is not allowed to use the catalog.",
      requestId,
    );
  }

  try {
    if (url.pathname === "/v1/search" && request.method === "GET") {
      return await search(request, env, context, requestId);
    }
    if (url.pathname === "/v1/catalog" && request.method === "POST") {
      return await importTitle(request, env, requestId);
    }
    return errorResponse(
      request,
      env,
      404,
      "not_found",
      "That catalog route does not exist.",
      requestId,
    );
  } catch (error) {
    const status = error instanceof TmdbApiError ? error.status : 500;
    const message =
      error instanceof TmdbApiError
        ? error.message
        : "The catalog could not complete that request.";
    console.error("catalog_request_failed", {
      requestId,
      path: url.pathname,
      status,
      error: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse(
      request,
      env,
      status,
      status === 404 ? "title_not_found" : "catalog_unavailable",
      message,
      requestId,
    );
  }
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
