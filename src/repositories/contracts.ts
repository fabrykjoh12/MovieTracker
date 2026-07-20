import type {
  AppState,
  EpisodeProgress,
  Media,
  Quality,
  Shelf,
  SocialPost,
  UserMediaState,
  Verdict,
  WatchEvent,
} from "../types";

export interface ProfileRecord {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  isPrivate: boolean;
}

export interface LibrarySnapshot {
  userMedia: Record<string, UserMediaState>;
  events: WatchEvent[];
  queue: string[];
}

export interface CloudLibrarySnapshot extends LibrarySnapshot {
  initialized: boolean;
  catalog: Media[];
}

export interface ProfileRepository {
  getCurrent(): Promise<ProfileRecord>;
  update(profile: Partial<Omit<ProfileRecord, "id">>): Promise<ProfileRecord>;
}

export interface MediaCatalogRepository {
  list(): Promise<Media[]>;
  get(mediaId: string): Promise<Media | undefined>;
}

export interface LibraryRepository {
  load(): Promise<LibrarySnapshot>;
  saveState(state: UserMediaState, queuePosition?: number): Promise<void>;
  removeState(mediaId: string): Promise<void>;
  reorderQueue(mediaIds: string[]): Promise<void>;
}

export interface LibrarySyncRepository extends LibraryRepository {
  load(): Promise<CloudLibrarySnapshot>;
  import(snapshot: LibrarySnapshot): Promise<CloudLibrarySnapshot>;
  persistChanges(previous: AppState, next: AppState): Promise<void>;
  refreshCatalog(): Promise<Media[]>;
  deleteAllData(): Promise<void>;
}

export interface TrackingRepository {
  list(mediaId?: string): Promise<WatchEvent[]>;
  record(event: WatchEvent, progress?: EpisodeProgress): Promise<void>;
  undo(eventId: string, restoredState: UserMediaState): Promise<void>;
}

export interface VerdictRepository {
  save(mediaId: string, verdict: Verdict): Promise<void>;
  remove(mediaId: string): Promise<void>;
}

export interface ShelfRepository {
  list(): Promise<Shelf[]>;
  save(shelf: Shelf): Promise<void>;
  reorder(shelfId: string, mediaIds: string[]): Promise<void>;
}

export interface SocialRepository {
  listVisible(
    mediaId: string,
    progress?: EpisodeProgress,
  ): Promise<SocialPost[]>;
}

export interface RepositoryBundle {
  profiles: ProfileRepository;
  catalog: MediaCatalogRepository;
  library: LibraryRepository;
  tracking: TrackingRepository;
  verdicts: VerdictRepository;
  shelves: ShelfRepository;
  social: SocialRepository;
}

export const verdictQualities: readonly Quality[] = [
  "Story",
  "Characters",
  "Performances",
  "Visuals",
  "Atmosphere",
  "Soundtrack",
  "Emotion",
  "Originality",
  "Ending",
  "Rewatchability",
];
