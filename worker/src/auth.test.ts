// @vitest-environment node
//
// Cloudflare Workers run in a V8-isolate/Node-like runtime, not a browser
// DOM. jsdom's WebCrypto shim produces Uint8Array instances jose's
// WebCrypto-based signing/verification rejects (a known jsdom/jose
// incompatibility — panva/jose#671), so this file needs the real Node
// environment instead of the project's jsdom default.
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, verifyAuthenticatedUser } from "./auth";

const ISSUER = "https://ep-example.neonauth.example.aws.neon.tech";
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const env = { NEON_AUTH_JWKS_URL: JWKS_URL, NEON_AUTH_BASE_URL: ISSUER };

let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
let originalFetch: typeof fetch;

async function sign(claims: { sub?: string; exp?: number; issuer?: string }) {
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setIssuer(claims.issuer ?? ISSUER)
    .setIssuedAt();
  if (claims.sub) jwt.setSubject(claims.sub);
  if (claims.exp) jwt.setExpirationTime(claims.exp);
  else jwt.setExpirationTime("15m");
  return jwt.sign(privateKey);
}

function request(token?: string) {
  return new Request("https://catalog.example/v1/catalog", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "test-key",
    alg: "ES256",
  };

  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === JWKS_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected fetch in test: ${String(input)}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("verifyAuthenticatedUser", () => {
  it("returns the user id for a validly signed, unexpired token", async () => {
    const token = await sign({ sub: "user-123" });
    await expect(verifyAuthenticatedUser(request(token), env)).resolves.toBe(
      "user-123",
    );
  });

  it("rejects a request with no Authorization header", async () => {
    await expect(verifyAuthenticatedUser(request(), env)).rejects.toMatchObject(
      {
        code: "unauthenticated",
      },
    );
  });

  it("rejects a malformed bearer token", async () => {
    await expect(
      verifyAuthenticatedUser(request("not-a-real-jwt"), env),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("rejects an expired token even though it is validly signed", async () => {
    const token = await sign({
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await expect(
      verifyAuthenticatedUser(request(token), env),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("rejects a validly signed token from the wrong issuer", async () => {
    const token = await sign({
      sub: "user-123",
      issuer: "https://attacker.example",
    });
    await expect(
      verifyAuthenticatedUser(request(token), env),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("throws a distinct error when auth is not configured server-side", async () => {
    const token = await sign({ sub: "user-123" });
    await expect(
      verifyAuthenticatedUser(request(token), {}),
    ).rejects.toMatchObject({ code: "auth_unavailable" });
  });

  it("is a real AuthError instance so callers can branch on it", async () => {
    try {
      await verifyAuthenticatedUser(request(), env);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
    }
  });
});
