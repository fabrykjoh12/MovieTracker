import { useEffect, useMemo, useState } from "react";
import {
  getCatalogSearchClient,
  isCatalogSearchConfigured,
} from "../catalog/search";
import type { MediaSearchResult } from "../catalog/search";
import { useStore } from "../store";
import type { MediaFormat } from "../types";

export type CatalogSearchState =
  "idle" | "searching" | "ready" | "success" | "error";

export function catalogResultKey(result: MediaSearchResult) {
  return `${result.mediaType}-${result.providerId}`;
}

export function catalogResultLocalId(result: MediaSearchResult) {
  return `tmdb-${catalogResultKey(result)}`;
}

export function useCatalogSearch() {
  const { dispatch, catalog, registerCatalogItem } = useStore();
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
    setBusyKey(key);
    setSearchMessage(`Preparing ${result.title}…`);
    try {
      const existing = catalog.find((item) => item.id === localId);
      const item = existing ?? (await client.importTitle(result));
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
