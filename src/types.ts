export type MediaFormat = "movie" | "series";
export type LibraryStatus =
  | "watching"
  | "up-next"
  | "planned"
  | "paused"
  | "completed"
  | "dropped"
  | "rewatching"
  | "archived";

export type VerdictKind =
  "all-timer" | "loved" | "liked" | "mixed" | "not-for-me" | "dropped";

export type Quality =
  | "Story"
  | "Characters"
  | "Performances"
  | "Visuals"
  | "Atmosphere"
  | "Soundtrack"
  | "Emotion"
  | "Originality"
  | "Ending"
  | "Rewatchability";

export interface Episode {
  id: string;
  number: number;
  title: string;
  runtime: number;
  synopsis: string;
}

export interface Season {
  number: number;
  title?: string;
  year: number;
  episodes: Episode[];
}

export interface Media {
  id: string;
  title: string;
  year: number;
  format: MediaFormat;
  poster: string;
  backdrop: string;
  accent: string;
  runtime: number;
  seasons?: Season[];
  genres: string[];
  moods: string[];
  pace: "measured" | "balanced" | "brisk";
  intensity: "light" | "balanced" | "demanding";
  adventurous: number;
  synopsis: string;
  creators: string[];
  cast: string[];
  services: string[];
  country: string;
  language: string;
  availabilityNote?: string;
  provider?: {
    name: "tmdb";
    id: number;
    mediaType: "movie" | "tv";
  };
}

export interface EpisodeProgress {
  season: number;
  episode: number;
}

export interface Verdict {
  kind: VerdictKind;
  normalized: number;
  qualities: Quality[];
  tags: string[];
  recordedAt: string;
  rank?: number;
}

export interface UserMediaState {
  mediaId: string;
  status: LibraryStatus;
  progress?: EpisodeProgress;
  watchedDates: string[];
  verdict?: Verdict;
  savedAt: string;
  intent?: {
    reason?: string;
    recommendedBy?: string;
    withWhom?: string;
    mood?: string;
    priority?: "low" | "medium" | "high";
    note?: string;
  };
}

export interface WatchEvent {
  id: string;
  mediaId: string;
  type: "episode" | "movie" | "season" | "rewatch";
  watchedAt: string;
  season?: number;
  episode?: number;
  previousState?: UserMediaState;
  previousQueueIndex?: number;
}

export interface Shelf {
  id: string;
  title: string;
  description: string;
  mediaIds: string[];
  featuredId: string;
  visibility: "private" | "public" | "collaborative";
  atmosphere: string;
}

export interface TonightFilters {
  maxRuntime: number;
  format: "any" | MediaFormat;
  mood: string;
  services: string[];
  company: "alone" | "together";
  familiarity: "familiar" | "adventurous";
  intensity: "light" | "balanced" | "demanding";
}

export interface SpoilerScope {
  mediaId: string;
  level: "title" | "season" | "episode";
  season?: number;
  episode?: number;
}

export interface SocialPost {
  id: string;
  author: string;
  avatar: string;
  text: string;
  kind: "reaction" | "review" | "theory" | "recommendation";
  scope: SpoilerScope;
  createdAt: string;
}

export interface RoomCandidate {
  mediaId: string;
  reason: string;
  votes: Record<string, "yes" | "maybe" | "no">;
}

export interface WatchTogetherRoom {
  id: string;
  name: string;
  host: string;
  participants: string[];
  constraints: {
    format: "any" | MediaFormat;
    maxRuntime: number;
    mood: string;
    services: string[];
  };
  candidates: RoomCandidate[];
  selectedId?: string;
}

export interface AppState {
  version: number;
  userMedia: Record<string, UserMediaState>;
  events: WatchEvent[];
  shelves: Shelf[];
  queue: string[];
  filters: TonightFilters;
  room: WatchTogetherRoom;
}
