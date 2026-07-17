import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "./index";

const context = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

function environment(success = true) {
  const limiter = { limit: vi.fn().mockResolvedValue({ success }) };
  return {
    TMDB_READ_ACCESS_TOKEN: "secret",
    DATABASE_URL: "postgresql://example.invalid/database",
    ALLOWED_ORIGINS: "https://fabrykjoh12.github.io,http://localhost:4173",
    SEARCH_RATE_LIMITER: limiter,
    IMPORT_RATE_LIMITER: limiter,
  } as Parameters<typeof handleRequest>[1];
}

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

  it("returns 429 when the edge rate limit is exhausted", async () => {
    const response = await handleRequest(
      new Request("https://catalog.example/v1/search?q=Arrival", {
        headers: { Origin: "http://localhost:4173" },
      }),
      environment(false),
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
