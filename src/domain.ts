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

const eventMinutes = (event: WatchEvent, media?: Media) => {
  if (!media) return 0;
  switch (event.type) {
    case "movie":
      return media.runtime;
    case "episode": {
      const season = media.seasons?.find((s) => s.number === event.season);
      const episode = season?.episodes.find((e) => e.number === event.episode);
      return episode?.runtime ?? media.runtime;
    }
    case "season": {
      const season = media.seasons?.find((s) => s.number === event.season);
      return (
        season?.episodes.reduce((sum, episode) => sum + episode.runtime, 0) ?? 0
      );
    }
    // A rewatch event only marks that a rewatch started; it carries no
    // watched duration of its own. Time watched during the rewatch is
    // captured by the movie/episode/season events that follow it.
    case "rewatch":
      return 0;
  }
};

export interface WeeklyWatchSummary {
  totalMinutes: number;
  /** Minutes watched per day, oldest (6 days ago) to newest (today). */
  dailyMinutes: number[];
}

const dayKey = (isoDate: string) => isoDate.slice(0, 10);

export const weeklyWatchSummary = (
  events: WatchEvent[],
  catalog: Media[],
  now = new Date(),
): WeeklyWatchSummary => {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    return dayKey(date.toISOString());
  });
  const dailyMinutes = days.map((key) =>
    events
      .filter((event) => dayKey(event.watchedAt) === key)
      .reduce(
        (sum, event) =>
          sum + eventMinutes(event, catalogById.get(event.mediaId)),
        0,
      ),
  );
  return {
    totalMinutes: dailyMinutes.reduce((sum, minutes) => sum + minutes, 0),
    dailyMinutes,
  };
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

const lastActivity = (entry: UserMediaState) =>
  entry.watchedDates.at(-1) ?? entry.savedAt;

/**
 * The account's real in-progress series, for the Home "Continue Watching"
 * hero -- the most recently watched title that is actively being watched
 * and still has a next episode to show. Returns undefined when there is
 * none, rather than a fallback title; the caller must render an honest
 * empty state instead of fabricating a hero.
 */
export const continueWatchingCandidate = (
  userMedia: Record<string, UserMediaState>,
  catalog: Media[],
): Media | undefined => {
  const candidates = Object.values(userMedia)
    .filter(
      (entry) => entry.status === "watching" || entry.status === "rewatching",
    )
    .map((entry) => ({
      entry,
      media: catalog.find((item) => item.id === entry.mediaId),
    }))
    .filter((candidate): candidate is { entry: UserMediaState; media: Media } =>
      Boolean(
        candidate.media?.format === "series" &&
        nextEpisode(candidate.media, candidate.entry.progress),
      ),
    )
    .sort(
      (a, b) =>
        lastActivity(b.entry).localeCompare(lastActivity(a.entry)) ||
        b.entry.savedAt.localeCompare(a.entry.savedAt),
    );
  return candidates[0]?.media;
};

export interface LibraryOverview {
  totalWatched: number;
  watchedThisYear: number;
  filmsThisYear: number;
  seriesThisYear: number;
  totalHours: number;
  hoursThisYear: number;
  totalRewatches: number;
  rewatchesThisYear: number;
  favouritesThisYear: number;
}

/**
 * Real, computed profile stats -- a title only counts once it has actually
 * been completed (or is being rewatched, which implies a prior completion),
 * and "this year" is judged by the account's own most recent activity on
 * that title, not a fabricated number.
 */
export const libraryOverview = (
  userMedia: Record<string, UserMediaState>,
  events: WatchEvent[],
  catalog: Media[],
  now = new Date(),
): LibraryOverview => {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const year = now.getFullYear();
  const finished = Object.values(userMedia).filter(
    (entry) => entry.status === "completed" || entry.status === "rewatching",
  );
  const finishedThisYear = finished.filter((entry) => {
    const last = entry.watchedDates.at(-1);
    return last ? new Date(last).getFullYear() === year : false;
  });
  const minutesFor = (candidates: WatchEvent[]) =>
    candidates.reduce(
      (sum, event) => sum + eventMinutes(event, catalogById.get(event.mediaId)),
      0,
    );
  const eventsThisYear = events.filter(
    (event) => new Date(event.watchedAt).getFullYear() === year,
  );
  const favouritesThisYear = Object.values(userMedia).filter(
    (entry) =>
      entry.verdict &&
      (entry.verdict.kind === "all-timer" || entry.verdict.kind === "loved") &&
      new Date(entry.verdict.recordedAt).getFullYear() === year,
  ).length;
  return {
    totalWatched: finished.length,
    watchedThisYear: finishedThisYear.length,
    filmsThisYear: finishedThisYear.filter(
      (entry) => catalogById.get(entry.mediaId)?.format === "movie",
    ).length,
    seriesThisYear: finishedThisYear.filter(
      (entry) => catalogById.get(entry.mediaId)?.format === "series",
    ).length,
    totalHours: Math.round(minutesFor(events) / 60),
    hoursThisYear: Math.round(minutesFor(eventsThisYear) / 60),
    totalRewatches: events.filter((event) => event.type === "rewatch").length,
    rewatchesThisYear: eventsThisYear.filter(
      (event) => event.type === "rewatch",
    ).length,
    favouritesThisYear,
  };
};

/**
 * The account's real personal canon for Profile -- titles it has actually
 * recorded a Verdict for, ordered by an explicit rank first (lower is
 * better, matching the #1/#2 display elsewhere) and by Verdict strength
 * otherwise. Returns an empty array rather than a fallback list; the
 * caller must render an honest empty state instead of fabricating one.
 */
export const topFavourites = (
  userMedia: Record<string, UserMediaState>,
  catalog: Media[],
  limit: number,
): Media[] => {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  return Object.values(userMedia)
    .map((entry) => ({
      entry,
      verdict: entry.verdict,
      media: catalogById.get(entry.mediaId),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        entry: UserMediaState;
        verdict: NonNullable<UserMediaState["verdict"]>;
        media: Media;
      } => Boolean(candidate.verdict && candidate.media),
    )
    .sort((a, b) => {
      if (a.verdict.rank !== undefined && b.verdict.rank !== undefined) {
        return a.verdict.rank - b.verdict.rank;
      }
      if (a.verdict.rank !== undefined) return -1;
      if (b.verdict.rank !== undefined) return 1;
      return b.verdict.normalized - a.verdict.normalized;
    })
    .slice(0, limit)
    .map((candidate) => candidate.media);
};

export interface TasteTag {
  label: string;
  size: "large" | "medium" | "small";
}

/**
 * A real word cloud of the account's genres and moods, drawn from titles
 * actually in its library (excluding dropped titles), sized by how often
 * each tag recurs -- not a fixed editorial list.
 */
export const tasteCloud = (
  userMedia: Record<string, UserMediaState>,
  catalog: Media[],
  limit = 8,
): TasteTag[] => {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const counts = new Map<string, number>();
  for (const entry of Object.values(userMedia)) {
    if (entry.status === "dropped") continue;
    const media = catalogById.get(entry.mediaId);
    if (!media) continue;
    for (const tag of [...media.genres, ...media.moods]) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = sorted[0]?.[1] ?? 0;
  return sorted.map(([label, count]) => ({
    label,
    size:
      count >= max * 0.7 ? "large" : count >= max * 0.4 ? "medium" : "small",
  }));
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
