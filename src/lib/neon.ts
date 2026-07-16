import type { Database } from "./database.types";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.trim();

export const isNeonConfigured = Boolean(authUrl && dataApiUrl);

async function createConfiguredClient() {
  const { createClient } = await import("@neondatabase/neon-js");
  return createClient<Database>({
    auth: { url: authUrl! },
    dataApi: { url: dataApiUrl! },
  });
}

let clientPromise: ReturnType<typeof createConfiguredClient> | null = null;

export function getNeonClient() {
  if (!isNeonConfigured) return Promise.resolve(null);
  clientPromise ??= createConfiguredClient();
  return clientPromise;
}
