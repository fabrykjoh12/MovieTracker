import {
  ArrowRight,
  BookmarkPlus,
  Check,
  Clock3,
  Compass,
  Info,
  Play,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  continueWatchingCandidate,
  nextEpisode,
  progressPercent,
  recommendationReason,
  tonightCandidates,
} from "../domain";
import { MediaCard } from "../components/MediaCard";
import { SectionHeader } from "../components/SectionHeader";
import { TonightControls } from "../components/TonightControls";
import { mediaActionLabel } from "../lib/mediaActionLabel";
import { useStore } from "../store";

const todayLabel = () =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(new Date())
    .toUpperCase();

const timeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const relativeDaysAgo = (isoDate?: string) => {
  if (!isoDate) return undefined;
  const days = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "a month ago" : `${months} months ago`;
};

export function Home() {
  const { state, dispatch, catalog } = useStore();
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.email?.split("@")[0];
  const hero = continueWatchingCandidate(state.userMedia, catalog);
  const heroState = hero ? state.userMedia[hero.id] : undefined;
  const upcoming = hero ? nextEpisode(hero, heroState?.progress) : undefined;
  const picks = tonightCandidates(catalog, state);
  const progress = hero ? progressPercent(hero, heroState?.progress) : 0;
  const lastWatched = relativeDaysAgo(heroState?.watchedDates.at(-1));

  const trackHero = () =>
    hero && dispatch({ type: "mark-next", mediaId: hero.id });

  return (
    <div className="page home-page">
      <section className="welcome-line">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>
            {timeOfDayGreeting()}
            {displayName ? `, ${displayName}` : ""}.
          </h1>
        </div>
        <p>
          {hero
            ? "Pick up where you left off."
            : "Nothing in progress. A quiet night to fill."}
        </p>
      </section>

      {hero && upcoming ? (
        <section
          className="continue-hero"
          style={
            {
              "--hero-image": `url(${hero.backdrop})`,
              "--hero-accent": hero.accent,
            } as React.CSSProperties
          }
        >
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot" /> CONTINUE WATCHING
            </p>
            <h2>{hero.title}</h2>
            <div className="episode-line">
              <strong>
                S{upcoming.season.number} E{upcoming.episode.number}
              </strong>
              <span>{upcoming.episode.title}</span>
            </div>
            <p className="hero-description">{upcoming.episode.synopsis}</p>
            <div className="hero-meta">
              <span>
                <Clock3 size={15} />
                {upcoming.episode.runtime} min
              </span>
              {hero.services[0] && (
                <span className="service-mark">{hero.services[0]}</span>
              )}
              {lastWatched && <span>Last watched {lastWatched}</span>}
            </div>
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={trackHero}
              >
                <Check size={18} />
                Mark episode watched
              </button>
              <Link className="secondary-button" to={`/title/${hero.id}`}>
                <Info size={18} />
                Details
              </Link>
            </div>
            <div className="hero-progress">
              <div>
                <span>
                  Season {heroState?.progress?.season} ·{" "}
                  {heroState?.progress?.episode} of{" "}
                  {upcoming.season.episodes.length}
                </span>
                <span>{progress}% overall</span>
              </div>
              <i>
                <b
                  style={{
                    width: `${((heroState?.progress?.episode ?? 0) / upcoming.season.episodes.length) * 100}%`,
                  }}
                />
              </i>
            </div>
          </div>
          <div className="hero-episode-card">
            <p>UP AFTER THIS</p>
            <span>
              S{upcoming.season.number} E{upcoming.episode.number + 1}
            </span>
            <strong>
              {upcoming.season.episodes[upcoming.episode.number]?.title ??
                "The next chapter"}
            </strong>
          </div>
        </section>
      ) : (
        <section className="continue-hero-empty empty-state">
          <h3>Nothing in progress</h3>
          <p>
            Start a series from tonight&rsquo;s picks or search to fill in your
            Continue Watching hero.
          </p>
          <Link className="secondary-button" to="/discover">
            <Compass size={18} />
            Find something to watch
          </Link>
        </section>
      )}

      <div className="home-zone">
        <div className="home-primary">
          <SectionHeader label="THREE, NOT THIRTY" title="Tonight's picks" />
          <TonightControls />
          <section
            className="tonight-grid"
            aria-label="Tonight's recommendations"
          >
            {picks.length ? (
              picks.map((item, index) => {
                const userState = state.userMedia[item.id];
                const onClick = userState
                  ? () => dispatch({ type: "mark-next", mediaId: item.id })
                  : () => dispatch({ type: "add", mediaId: item.id });
                return (
                  <MediaCard
                    key={item.id}
                    title={item.title}
                    to={`/title/${item.id}`}
                    poster={item.poster}
                    pill={index === 0 ? "Up next" : undefined}
                    meta={`${item.year} · ${
                      item.format === "movie"
                        ? `${item.runtime} min`
                        : `${item.seasons?.length ?? 0} seasons`
                    }`}
                    reason={recommendationReason(item, userState)}
                    footer={
                      <button
                        type="button"
                        className="card-action"
                        onClick={onClick}
                        aria-label={`${mediaActionLabel(item, userState)} — ${item.title}`}
                      >
                        {userState ? (
                          <Play size={15} />
                        ) : (
                          <BookmarkPlus size={15} />
                        )}
                        {mediaActionLabel(item, userState)}
                      </button>
                    }
                  />
                );
              })
            ) : (
              <div className="empty-state">
                <h3>No honest matches yet.</h3>
                <p>Relax one filter and the shortlist will rebuild.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="home-rail">
          <SectionHeader label="THIS WEEK" title="Worth knowing" />
          <div className="empty-state home-rail-empty">
            <h3>Nothing to report yet</h3>
            <p>
              Episode reminders, availability alerts, and friend activity
              aren&rsquo;t live yet. This space will fill in as those launch.
            </p>
          </div>
          <Link className="text-link" to="/friends">
            See friend space <ArrowRight size={15} />
          </Link>
        </aside>
      </div>

      <div className="undo-strip" role="status" aria-live="polite">
        <RotateCcw size={15} />
        <span>Tracking mistakes are always reversible.</span>
        <button type="button" onClick={() => dispatch({ type: "undo" })}>
          Undo last
        </button>
      </div>
    </div>
  );
}
