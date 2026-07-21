import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthEnv {
  NEON_AUTH_JWKS_URL?: string;
  NEON_AUTH_BASE_URL?: string;
}

/**
 * Thrown for every authentication failure. `code` distinguishes the reason
 * (missing header vs. a present-but-invalid/expired token) so callers can
 * return a precise error code without inspecting jose's internals.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "invalid_token" | "auth_unavailable",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Built once per isolate and reused across requests, per Neon's guidance —
// only rebuilt if the configured JWKS URL changes (never happens in a
// running deployment; lets tests use distinct URLs safely).
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;

function jwksFor(jwksUrl: string) {
  if (cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks!;
}

/**
 * Verifies the request carries a valid, unexpired Neon Auth JWT and returns
 * the authenticated user's id (the token's `sub` claim). Throws AuthError
 * for every failure mode (missing header, malformed token, bad signature,
 * expired token, wrong issuer, or missing server-side configuration) —
 * callers must not treat "no throw" as anything but a real authenticated user.
 */
export async function verifyAuthenticatedUser(
  request: Request,
  env: AuthEnv,
): Promise<string> {
  if (!env.NEON_AUTH_JWKS_URL || !env.NEON_AUTH_BASE_URL) {
    throw new AuthError(
      "Authentication is not configured on this deployment.",
      "auth_unavailable",
    );
  }

  const header = request.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new AuthError("Sign in to do that.", "unauthenticated");
  }
  const token = header.slice(7).trim();
  if (!token) {
    throw new AuthError("Sign in to do that.", "unauthenticated");
  }

  try {
    const { payload } = await jwtVerify(
      token,
      jwksFor(env.NEON_AUTH_JWKS_URL),
      { issuer: new URL(env.NEON_AUTH_BASE_URL).origin },
    );
    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new AuthError(
        "Your session could not be verified.",
        "invalid_token",
      );
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "Your session has expired or is invalid. Sign in again.",
      "invalid_token",
    );
  }
}
