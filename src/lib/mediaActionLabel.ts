import type { Media, UserMediaState } from "../types";

/**
 * The visible label for a library/track action button, shared by Home,
 * Discover, and Library so the wording never drifts between surfaces.
 */
export function mediaActionLabel(item: Media, userState?: UserMediaState) {
  if (!userState) return "Add to library";
  if (item.format === "series") return "Next episode";
  return userState.status === "completed" ? "Watched" : "Log watched";
}
