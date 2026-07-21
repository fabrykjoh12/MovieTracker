import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  getCatalogSearchClient,
  isCatalogSearchConfigured,
} from "../catalog/search";
import type { MediaSearchResult } from "../catalog/search";
import { getNeonClient } from "../lib/neon";
import { useStore } from "../store";
import type { MediaFormat } from "../types";

const SIGN_IN_TO_ADD_MESSAGE =
  "Sign in to add new titles from search to your library.";

/**
 * `@neondatabase/neon-js@0.6.2-beta`'s published types for the default
 * (no explicit adapter) `createClient` overload resolve `.auth` to the raw
 * better-auth vanilla client type, which omits `getJWTToken` -- even
 * though it is present at runtime and is @neondatabase/auth's own
 * documented API for exactly this purpose (see
 * node_modules/@neondatabase/auth/dist/adapter-core-*.mjs and the
 * package's README). This narrowly names the real runtime shape instead
 * of reaching for `any`.
 */
interface NeonAuthClientWithJwtToken {
  getJWTToken(allowAnonymous: boolean): Promise<string | null>;
}

async function fetchAccessToken(): Promise<string | null> {
  const neonClient = await getNeonClient();
  if (!neonClient) return null;
  try {
    return await (
      neonClient.auth as unknown as NeonAuthClientWithJwtToken
    ).getJWTToken(false);
  } catch {
    return null;
  }
}

export type CatalogSearchState =
  | "idle"
  | "searching"
  | "ready"
  | "success"
  | "error";

export function catalogResultKey(result: MediaSearchResult) {
  return `${result.mediaType}-${result.providerId}`;
}

export function catalogResultLocalId(result: MediaSearchResult) {
  return `tmdb-${catalogResultKey(result)}`;
}

export function useCatalogSearch() {
  const { dispatch, catalog, registerCatalogItem } = useStore();
  const { status: authStatus } = useAuth();
  const [query, setQueryValue] = useState("");
  const [format, setFormatValue] = useState<"any" | MediaFormat>("any");
  const [searchState, setSearchState] = useState<CatalogSearchState>("idle");
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string>();
  const client = useMemo(() => getCatalogSearchClient(), []);

  useEffect(() => {
    const normalized = query.trim();
    if (!client || normalized.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResults([]);
      setSearchState("searching");
      setSearchMessage("");
      client
        .search(normalized, format, controller.signal)
        .then((response) => {
          setResults(response.results);
          setSearchState("ready");
          setSearchMessage(
            response.results.length
              ? `${response.results.length} titles found.`
              : `No titles found for “${normalized}”.`,
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setResults([]);
          setSearchState("error");
          setSearchMessage(
            error instanceof Error
              ? error.message
              : "Catalog search is temporarily unavailable.",
          );
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [client, format, query]);

  const setQuery = (nextQuery: string) => {
    setQueryValue(nextQuery);
    if (nextQuery.trim().length < 2) {
      setResults([]);
      setSearchState("idle");
      setSearchMessage("");
    } else {
      setResults([]);
      setSearchState("searching");
      setSearchMessage("");
    }
  };

  const setFormat = (nextFormat: "any" | MediaFormat) => {
    setFormatValue(nextFormat);
    if (query.trim().length >= 2) {
      setResults([]);
      setSearchState("searching");
      setSearchMessage("");
    }
  };

  const addToLibrary = async (result: MediaSearchResult) => {
    if (!client) return null;
    const key = catalogResultKey(result);
    const localId = catalogResultLocalId(result);
    const existing = catalog.find((item) => item.id === localId);
    // A brand-new title requires a trusted, authenticated catalog write.
    // Fail fast with an honest message instead of a wasted round trip to
    // the same 401 the server would return anyway.
    if (!existing && authStatus !== "authenticated") {
      setSearchState("error");
      setSearchMessage(SIGN_IN_TO_ADD_MESSAGE);
      return null;
    }
    setBusyKey(key);
    setSearchMessage(`Preparing ${result.title}…`);
    try {
      const item =
        existing ??
        (await client.importTitle(
          result,
          authStatus === "authenticated" ? await fetchAccessToken() : null,
        ));
      if (!existing) await registerCatalogItem(item);
      dispatch({ type: "add", mediaId: item.id });
      setSearchState("success");
      setSearchMessage(`${item.title} was added to your library.`);
      return item;
    } catch (error) {
      setSearchState("error");
      setSearchMessage(
        error instanceof Error
          ? error.message
          : "This title could not be added right now.",
      );
      return null;
    } finally {
      setBusyKey(undefined);
    }
  };

  return {
    configured: isCatalogSearchConfigured,
    query,
    setQuery,
    format,
    setFormat,
    searchState,
    results,
    searchMessage,
    busyKey,
    addToLibrary,
  };
}
