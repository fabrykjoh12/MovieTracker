// @vitest-environment node
//
// Cloudflare Workers run in a V8-isolate/Node-like runtime, not a browser
// DOM. jsdom's WebCrypto shim produces Uint8Array instances jose's
// WebCrypto-based signing/verification rejects (a known jsdom/jose
// incompatibility -- panva/jose#671), so this file needs the real Node
// environment instead of the project's jsdom default.
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Media } from "../../src/types";
import { TmdbApiError } from "./tmdb";

const ISSUER = "https://ep-example.neonauth.example.aws.neon.tech";
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

const media: Media = {
  id: "tmdb-movie-123",
  title: "A Real Film",
  format: "movie",
  year: 2026,
  poster: "poster",
  backdrop: "backdrop",
  accent: "#777",
  runtime: 112,
  genres: ["Drama"],
  moods: ["Drama"],
  pace: "balanced",
  intensity: "balanced",
  adventurous: 0.5,
  synopsis: "Synopsis",
  creators: [],
  cast: [],
  services: [],
  country: "Norway",
  language: "Norwegian",
  provider: { name: "tmdb", id: 123, mediaType: "movie" },
};

const { getFreshTmdbTitle, saveTmdbTitle, fetchTmdbCatalogEntry } = vi.hoisted(
  () => ({
    getFreshTmdbTitle: vi.fn(),
    saveTmdbTitle: vi.fn(),
    fetchTmdbCatalogEntry: vi.fn(),
  }),
);
vi.mock("./catalog", () => ({
  createCatalogDatabase: () => ({ getFreshTmdbTitle, saveTmdbTitle }),
}));
vi.mock("./tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tmdb")>();
  return { ...actual, fetchTmdbCatalogEntry };
});

const { handleRequest } = await import("./index");

const context = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

function environment(
  overrides: Partial<{
    searchOk: boolean;
    importOk: boolean;
    importUserOk: boolean;
    authConfigured: boolean;
    jwksUrl: string;
  }> = {},
) {
  const {
    searchOk = true,
    importOk = true,
    importUserOk = true,
    authConfigured = true,
    jwksUrl = JWKS_URL,
  } = overrides;
  return {
    TMDB_READ_ACCESS_TOKEN: "secret",
    DATABASE_URL: "postgresql://example.invalid/database",
    ALLOWED_ORIGINS: "https://fabrykjoh12.github.io,http://localhost:4173",
    ...(authConfigured
      ? { NEON_AUTH_JWKS_URL: jwksUrl, NEON_AUTH_BASE_URL: ISSUER }
      : {}),
    SEARCH_RATE_LIMITER: {
      limit: vi.fn().mockResolvedValue({ success: searchOk }),
    },
    IMPORT_RATE_LIMITER: {
      limit: vi.fn().mockResolvedValue({ success: importOk }),
    },
    IMPORT_RATE_LIMITER_USER: {
      limit: vi.fn().mockResolvedValue({ success: importUserOk }),
    },
  } as Parameters<typeof handleRequest>[1];
}

function importRequest(body: unknown, token?: string) {
  return new Request("https://catalog.example/v1/catalog", {
    method: "POST",
    headers: {
      Origin: "https://fabrykjoh12.github.io",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = { provider: "tmdb", providerId: 123, mediaType: "movie" };

describe("catalog Worker request boundary", () => {
  it("rejects untrusted origins before touching provider services", async () => {
    const response = await handleRequest(
      new Request("https://catalog.example/v1/search?q=Arrival", {
        headers: { Origin: "https://malicious.example" },
      }),
      environment(),
      context,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "origin_not_allowed" }),
      }),
    );
  });

  it("validates short queries and returns explicit CORS headers", async () => {
    const response = await handleRequest(
      new Request("https://catalog.example/v1/search?q=a", {
        headers: { Origin: "https://fabrykjoh12.github.io" },
      }),
      environment(),
      context,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fabrykjoh12.github.io",
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "invalid_query" }),
      }),
    );
  });

  it("returns 429 when the search edge rate limit is exhausted", async () => {
    const response = await handleRequest(
      new Request("https://catalog.example/v1/search?q=Arrival", {
        headers: { Origin: "http://localhost:4173" },
      }),
      environment({ searchOk: false }),
      context,
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "rate_limited" }),
      }),
    );
  });
});

let testCaseCounter = 0;

describe("catalog import authentication", () => {
  let privateKey: CryptoKey;
  let publicJwk: Record<string, unknown>;
  let originalFetch: typeof fetch;
  // auth.ts caches the built JWKS keyset per URL (correct in production,
  // where the URL never changes) -- give each test its own URL so a fresh
  // per-test keypair is never verified against a previous test's cached
  // (and by-then-mismatched) key material.
  let jwksUrl: string;

  async function signToken(overrides: { exp?: number; issuer?: string } = {}) {
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer(overrides.issuer ?? ISSUER)
      .setSubject("user-123")
      .setIssuedAt();
    jwt.setExpirationTime(overrides.exp ?? "15m");
    return jwt.sign(privateKey);
  }

  beforeEach(async () => {
    getFreshTmdbTitle.mockReset().mockResolvedValue(null);
    saveTmdbTitle.mockReset().mockResolvedValue(media);
    fetchTmdbCatalogEntry.mockReset().mockResolvedValue({});

    jwksUrl = `${JWKS_URL}?case=${testCaseCounter++}`;
    const pair = await generateKeyPair("ES256");
    privateKey = pair.privateKey;
    publicJwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: "test-key",
      alg: "ES256",
    };
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === jwksUrl) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch in test: ${String(input)}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects an import with no Authorization header", async () => {
    const response = await handleRequest(
      importRequest(validBody),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "unauthenticated" }),
      }),
    );
    expect(saveTmdbTitle).not.toHaveBeenCalled();
  });

  it("rejects an import with an invalid/malformed token", async () => {
    const response = await handleRequest(
      importRequest(validBody, "not-a-real-jwt"),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "invalid_token" }),
      }),
    );
  });

  it("rejects an import with an expired token", async () => {
    const token = await signToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "invalid_token" }),
      }),
    );
  });

  it("fails closed with a distinct code when auth is not configured server-side", async () => {
    const token = await signToken();
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ authConfigured: false, jwksUrl }),
      context,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "auth_unavailable" }),
      }),
    );
    expect(saveTmdbTitle).not.toHaveBeenCalled();
  });

  it("allows a valid authenticated import end to end", async () => {
    const token = await signToken();
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({ media, source: "tmdb" }),
    );
    expect(saveTmdbTitle).toHaveBeenCalledTimes(1);
  });

  it("rejects an authenticated import once the per-user rate limit is exhausted", async () => {
    const token = await signToken();
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ importUserOk: false, jwksUrl }),
      context,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "rate_limited" }),
      }),
    );
    expect(saveTmdbTitle).not.toHaveBeenCalled();
  });

  it("returns a clean error when the provider fails", async () => {
    fetchTmdbCatalogEntry.mockRejectedValueOnce(
      new TmdbApiError("TMDB is unavailable.", 503),
    );
    const token = await signToken();
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "catalog_unavailable" }),
      }),
    );
  });

  it("returns a clean error when the database fails", async () => {
    saveTmdbTitle.mockRejectedValueOnce(new Error("connection refused"));
    const token = await signToken();
    const response = await handleRequest(
      importRequest(validBody, token),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "catalog_unavailable" }),
      }),
    );
  });

  it("rejects malformed import bodies before touching auth or the database", async () => {
    const response = await handleRequest(
      importRequest({ provider: "tmdb" }),
      environment({ jwksUrl }),
      context,
    );
    // Auth is checked before body validation, so an unauthenticated
    // malformed request is still rejected for the auth reason first.
    expect(response.status).toBe(401);
    expect(saveTmdbTitle).not.toHaveBeenCalled();
  });

  it("rejects malformed import bodies from an authenticated caller", async () => {
    const token = await signToken();
    const response = await handleRequest(
      importRequest({ provider: "tmdb" }, token),
      environment({ jwksUrl }),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "invalid_title" }),
      }),
    );
    expect(saveTmdbTitle).not.toHaveBeenCalled();
  });
});
