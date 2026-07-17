import type { TmdbCatalog } from "../catalog/tmdb";

// This safe fallback is replaced during a configured local or GitHub build.
export const tmdbCatalog: TmdbCatalog = {
  generatedAt: null,
  entries: {},
};
