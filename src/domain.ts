import type {
  AppState,
  Episode,
  EpisodeProgress,
  LibraryStatus,
  Media,
  RoomCandidate,
  SpoilerScope,
  Season,
  TonightFilters,
  UserMediaState,
  VerdictKind,
  WatchEvent,
  WatchTogetherRoom,
} from "./types";

export const verdictScore: Record<VerdictKind, number> = {
  "all-timer": 0.97,
  loved: 0.86,
  liked: 0.7,
  mixed: 0.5,
  "not-for-me": 0.26,
  dropped: 0.12,
};

export const normalizeVerdict = (kind: VerdictKind) => verdictScore[kind];

export const formatVerdict = (kind: VerdictKind) =>
  ({
    "all-timer": "All-timer",
    loved: "Loved it",
    liked: "Liked it",
    mixed: "Mixed",
    "not-for-me": "Not for me",
    dropped: "Dropped",
  })[kind];

export const totalEpisodes = (media: Media) =>
  media.seasons?.reduce((sum, season) => sum + season.episodes.length, 0) ?? 0;

export const watchedEpisodes = (media: Media, progress?: EpisodeProgress) => {
  if (!progress || !media.seasons) return 0;
  const earlier = media.seasons
    .filter((season) => season.number < progress.season)
    .reduce((sum, season) => sum + season.episodes.length, 0);
  return earlier + progress.episode;
};

export const progressPercent = (media: Media, progress?: EpisodeProgress) => {
  if (media.format === "movie") return progress ? 100 : 0;
  const total = totalEpisodes(media);
  return total
    ? Math.round((watchedEpisodes(media, progress) / total) * 100)
    : 0;
};

export const nextEpisode = (
  media: Media,
  progress?: EpisodeProgress,
): { season: Season; episode: Episode } | undefined => {
  if (!media.seasons?.length) return undefined;
  const firstSeason = media.seasons[0];
  const firstEpisode = firstSeason?.episodes[0];
  if (!firstSeason || !firstEpisode) return undefined;
  if (!progress) return { season: firstSeason, episode: firstEpisode };
  const seasonIndex = media.seasons.findIndex(
    (season) => season.number === progress.season,
  );
  const season = media.seasons[seasonIndex];
  const next = season?.episodes.find(
    (episode) => episode.number === progress.episode + 1,
  );
  if (season && next) return { season, episode: next };
  const followingSeason = media.seasons[seasonIndex + 1];
  const followingEpisode = followingSeason?.episodes[0];
  return followingSeason && followingEpisode
    ? { season: followingSeason, episode: followingEpisode }
    : undefined;
};

export const markNextEpisode = (
  current: UserMediaState,
  media: Media,
  now = new Date().toISOString(),
): { state: UserMediaState; event?: WatchEvent } => {
  const next = nextEpisode(media, current.progress);
  if (!next) return { state: current };
  const complete = !nextEpisode(media, {
    season: next.season.number,
    episode: next.episode.number,
  });
  const previousState = structuredClone(current);
  const state: UserMediaState = {
    ...current,
    status: complete
      ? "completed"
      : ["paused", "up-next", "planned"].includes(current.status)
        ? "watching"
        : current.status,
    progress: { season: next.season.number, episode: next.episode.number },
    watchedDates: [...current.watchedDates, now],
  };
  return {
    state,
    event: {
      id: `event-${now}-${media.id}`,
      mediaId: media.id,
      type: "episode",
      season: next.season.number,
      episode: next.episode.number,
      watchedAt: now,
      previousState,
    },
  };
};

export const completeSeason = (
  current: UserMediaState,
  media: Media,
  seasonNumber: number,
  now = new Date().toISOString(),
): { state: UserMediaState; event: WatchEvent } => {
  const season = media.seasons?.find((item) => item.number === seasonNumber);
  if (!season) throw new Error("Season not found");
  const isFinal = media.seasons?.at(-1)?.number === seasonNumber;
  const previousState = structuredClone(current);
  return {
    state: {
      ...current,
      status: isFinal ? "completed" : "watching",
      progress: { season: season.number, episode: season.episodes.length },
      watchedDates: [...current.watchedDates, now],
    },
    event: {
      id: `event-${now}-${media.id}-season`,
      mediaId: media.id,
      type: "season",
      season: seasonNumber,
      watchedAt: now,
      previousState,
    },
  };
};

export const undoLastTracking = (state: AppState): AppState => {
  const lastIndex = state.events.findLastIndex((event) =>
    Boolean(event.previousState),
  );
  if (lastIndex < 0) return state;
  const event = state.events[lastIndex];
  if (!event?.previousState) return state;
  const shouldRestoreQueue =
    event.previousQueueIndex !== undefined ||
    event.previousState.status === "up-next";
  const queue = state.queue.filter((mediaId) => mediaId !== event.mediaId);
  if (shouldRestoreQueue) {
    const index = Math.min(
      event.previousQueueIndex ?? queue.length,
      queue.length,
    );
    queue.splice(index, 0, event.mediaId);
  }
  return {
    ...state,
    userMedia: { ...state.userMedia, [event.mediaId]: event.previousState },
    events: state.events.filter((_, index) => index !== lastIndex),
    queue,
  };
};

export const startRewatch = (
  current: UserMediaState,
  now = new Date().toISOString(),
): UserMediaState => ({
  ...current,
  status: "rewatching",
  progress: undefined,
  watchedDates: [...current.watchedDates, now],
});

const allowedTransitions: Record<LibraryStatus, LibraryStatus[]> = {
  watching: ["paused", "dropped", "completed", "archived"],
  "up-next": ["watching", "planned", "archived"],
  planned: ["up-next", "watching", "archived", "dropped"],
  paused: ["watching", "dropped", "archived"],
  completed: ["rewatching", "archived"],
  dropped: ["planned", "watching", "archived"],
  rewatching: ["paused", "completed", "archived"],
  archived: ["planned", "up-next"],
};

export const canTransition = (from: LibraryStatus, to: LibraryStatus) =>
  from === to || allowedTransitions[from].includes(to);

export const moveQueueItem = (
  queue: string[],
  mediaId: string,
  direction: -1 | 1,
) => {
  const currentIndex = queue.indexOf(mediaId);
  if (currentIndex < 0) return queue;
  const target = currentIndex + direction;
  if (target < 0 || target >= queue.length) return queue;
  const copy = [...queue];
  [copy[currentIndex], copy[target]] = [copy[target]!, copy[currentIndex]!];
  return copy;
};

export const moveShelfItem = moveQueueItem;

export const placeByPairwise = (
  ranking: string[],
  newId: string,
  comparisonId: string,
  prefersNew: boolean,
) => {
  const withoutNew = ranking.filter((id) => id !== newId);
  const comparisonIndex = withoutNew.indexOf(comparisonId);
  if (comparisonIndex < 0) return [...withoutNew, newId];
  const insertAt = prefersNew ? comparisonIndex : comparisonIndex + 1;
  return [
    ...withoutNew.slice(0, insertAt),
    newId,
    ...withoutNew.slice(insertAt),
  ];
};

const moodMatches = (media: Media, mood: string) =>
  mood === "Any mood" ||
  media.moods.some((item) => item.toLowerCase().includes(mood.toLowerCase()));

export const candidateEligible = (media: Media, filters: TonightFilters) => {
  const runtime = media.format === "series" ? media.runtime : media.runtime;
  return (
    runtime <= filters.maxRuntime &&
    (filters.format === "any" || media.format === filters.format) &&
    moodMatches(media, filters.mood) &&
    (filters.services.length === 0 ||
      media.services.some((service) => filters.services.includes(service))) &&
    (filters.intensity === "balanced" || media.intensity === filters.intensity)
  );
};

export const scoreTonightCandidate = (
  media: Media,
  filters: TonightFilters,
  userState?: UserMediaState,
) => {
  if (!candidateEligible(media, filters)) return -Infinity;
  let score = 30;
  if (userState?.status === "up-next") score += 25;
  if (userState?.status === "planned") score += 12;
  if (filters.mood !== "Any mood" && moodMatches(media, filters.mood))
    score += 18;
  if (filters.familiarity === "adventurous") score += media.adventurous * 2;
  else score += (10 - media.adventurous) * 1.5;
  if (
    filters.company === "together" &&
    ["Comedy", "Adventure", "Mystery"].some((genre) =>
      media.genres.includes(genre),
    )
  )
    score += 10;
  score += Math.max(0, 12 - Math.abs(filters.maxRuntime - media.runtime) / 10);
  return score;
};

export const tonightCandidates = (items: Media[], state: AppState) =>
  items
    .filter((item) => state.userMedia[item.id]?.status !== "completed")
    .map((item) => ({
      item,
      score: scoreTonightCandidate(
        item,
        state.filters,
        state.userMedia[item.id],
      ),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);

export const recommendationReason = (item: Media, state?: UserMediaState) => {
  if (state?.status === "up-next")
    return `Already in Up Next · ${item.runtime} minutes · available on ${item.services[0]}`;
  if (item.adventurous >= 8)
    return `A thoughtful wildcard: ${item.moods.slice(0, 2).join(", ").toLowerCase()}, with a bolder structure than your usual picks.`;
  if (item.genres.includes("Science fiction"))
    return "Because you loved the atmosphere of Dark, the emotional ideas in Arrival, and patient science fiction.";
  return `Matches your taste for ${item.moods.slice(0, 2).join(" and ").toLowerCase()} stories without repeating your recent watches.`;
};

export const isSpoilerVisible = (
  scope: SpoilerScope,
  progress?: EpisodeProgress,
  completed = false,
) => {
  if (scope.level === "title") return completed;
  if (!progress) return false;
  if ((scope.season ?? 1) < progress.season) return true;
  if ((scope.season ?? 1) > progress.season) return false;
  if (scope.level === "season") return completed || progress.episode >= 99;
  return (scope.episode ?? 0) <= progress.episode;
};

export const matchRoomCandidates = (
  room: WatchTogetherRoom,
  items: Media[],
): RoomCandidate[] =>
  items
    .filter(
      (item) =>
        room.constraints.format === "any" ||
        item.format === room.constraints.format,
    )
    .filter((item) => item.runtime <= room.constraints.maxRuntime)
    .filter((item) =>
      item.services.some((service) =>
        room.constraints.services.includes(service),
      ),
    )
    .slice(0, 5)
    .map((item) => ({
      mediaId: item.id,
      reason: `${item.runtime} min · ${item.services[0]} · fits ${room.constraints.mood.toLowerCase()} night`,
      votes: {},
    }));

export const mutualMatches = (room: WatchTogetherRoom) =>
  room.candidates
    .filter((candidate) =>
      room.participants.every((person) => candidate.votes[person] !== "no"),
    )
    .sort((a, b) => {
      const score = (candidate: RoomCandidate) =>
        Object.values(candidate.votes).reduce(
          (sum, vote) => sum + (vote === "yes" ? 2 : vote === "maybe" ? 1 : -4),
          0,
        );
      return score(b) - score(a);
    });

export interface RatingAggregate {
  lovedPercent: number;
  allTimerPercent: number;
  mean: number;
  confidence: "low" | "developing" | "strong";
}

export const aggregateVerdicts = (
  verdicts: VerdictKind[],
  priorMean = 0.66,
  priorWeight = 8,
): RatingAggregate => {
  const count = verdicts.length;
  const observed = verdicts.reduce(
    (sum, verdict) => sum + verdictScore[verdict],
    0,
  );
  return {
    lovedPercent: count
      ? Math.round(
          (verdicts.filter((item) => item === "loved" || item === "all-timer")
            .length /
            count) *
            100,
        )
      : 0,
    allTimerPercent: count
      ? Math.round(
          (verdicts.filter((item) => item === "all-timer").length / count) *
            100,
        )
      : 0,
    mean: Number(
      ((observed + priorMean * priorWeight) / (count + priorWeight)).toFixed(3),
    ),
    confidence: count < 10 ? "low" : count < 50 ? "developing" : "strong",
  };
};

export const statusLabel = (status: LibraryStatus) =>
  ({
    watching: "Watching",
    "up-next": "Up Next",
    planned: "Planned",
    paused: "Paused",
    completed: "Completed",
    dropped: "Dropped",
    rewatching: "Rewatching",
    archived: "Archived",
  })[status];
