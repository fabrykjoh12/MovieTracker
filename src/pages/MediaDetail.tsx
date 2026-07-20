import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  ChevronDown,
  EyeOff,
  History,
  LockKeyhole,
  Play,
  Plus,
  RotateCcw,
  Star,
  Users,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { socialPosts } from "../data";
import {
  aggregateVerdicts,
  formatVerdict,
  isSpoilerVisible,
  nextEpisode,
  progressPercent,
  statusLabel,
} from "../domain";
import { useStore } from "../store";
import { VerdictModal } from "../components/VerdictModal";
import type { LibraryStatus } from "../types";

const statuses: LibraryStatus[] = [
  "watching",
  "up-next",
  "planned",
  "paused",
  "completed",
  "dropped",
  "rewatching",
  "archived",
];

export function MediaDetail() {
  const { id = "" } = useParams();
  const { state, dispatch, catalog } = useStore();
  const item = catalog.find((entry) => entry.id === id);
  const userState = state.userMedia[id];
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [season, setSeason] = useState(
    () => userState?.progress?.season ?? item?.seasons?.[0]?.number ?? 1,
  );
  const [revealed, setRevealed] = useState<string[]>([]);
  const progress = item ? progressPercent(item, userState?.progress) : 0;
  const next = item ? nextEpisode(item, userState?.progress) : undefined;
  const posts = socialPosts.filter((post) => post.scope.mediaId === id);
  const aggregate = useMemo(
    () =>
      aggregateVerdicts([
        "loved",
        "loved",
        "all-timer",
        "liked",
        "loved",
        "mixed",
        "all-timer",
        "liked",
        "loved",
        "loved",
        "liked",
        "loved",
      ]),
    [],
  );

  if (!item) return <Navigate to="/" replace />;
  const seasons = item.seasons ?? [];
  const seasonData = seasons.find((entry) => entry.number === season);
  const completed = userState?.status === "completed";
  const track = () =>
    userState
      ? dispatch({ type: "mark-next", mediaId: item.id })
      : dispatch({
          type: "add",
          mediaId: item.id,
          status: item.format === "series" ? "watching" : "planned",
        });

  return (
    <div className="detail-page">
      <section
        className="detail-hero"
        style={
          {
            "--detail-image": `url(${item.backdrop})`,
            "--detail-accent": item.accent,
          } as React.CSSProperties
        }
      >
        <div className="detail-scrim" />
        <Link className="back-link" to="/">
          <ArrowLeft size={17} />
          Back
        </Link>
        <div className="detail-content">
          <img
            className="detail-poster"
            src={item.poster}
            alt={`${item.title} editorial artwork`}
          />
          <div className="detail-copy">
            <p className="eyebrow">
              {item.format} · {item.country}
            </p>
            <h1>{item.title}</h1>
            <div className="detail-meta">
              <span>{item.year || "Date pending"}</span>
              <span>{item.genres.slice(0, 2).join(" · ")}</span>
              <span>
                {item.format === "movie"
                  ? item.runtime > 0
                    ? `${item.runtime} min`
                    : "Runtime unavailable"
                  : item.seasons?.length
                    ? `${item.seasons.length} seasons`
                    : "Episode guide pending"}
              </span>
              <span>{item.language}</span>
            </div>
            <p className="detail-synopsis">{item.synopsis}</p>
            <div className="service-row">
              <span>{item.services.length ? "Watch on" : "Availability"}</span>
              {item.services.length ? (
                item.services.map((service) => (
                  <strong key={service}>{service}</strong>
                ))
              ) : (
                <strong>Not listed for Norway</strong>
              )}
              {item.availabilityNote && <small>{item.availabilityNote}</small>}
            </div>
            <div className="detail-actions">
              <button
                className="primary-button"
                type="button"
                onClick={track}
                disabled={
                  (item.format === "movie" && completed) ||
                  (item.format === "series" && Boolean(userState) && !next)
                }
              >
                {userState ? (
                  item.format === "series" ? (
                    <>
                      <Play size={18} fill="currentColor" />
                      {next
                        ? `Mark S${next.season.number} E${next.episode?.number} watched`
                        : "Episode guide unavailable"}
                    </>
                  ) : completed ? (
                    <>
                      <Check size={18} />
                      Watched
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Log watched
                    </>
                  )
                ) : (
                  <>
                    <BookmarkPlus size={18} />
                    Add to library
                  </>
                )}
              </button>
              {userState && (
                <label className="status-select">
                  <span className="sr-only">Library state</span>
                  <select
                    value={userState.status}
                    onChange={(event) =>
                      dispatch({
                        type: "status",
                        mediaId: id,
                        status: event.target.value as LibraryStatus,
                      })
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </label>
              )}
              {completed && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => dispatch({ type: "rewatch", mediaId: id })}
                  aria-label={`Start rewatching ${item.title}`}
                >
                  <RotateCcw size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="detail-body">
        {userState && (
          <section className="personal-panel">
            <div className="progress-overview">
              <div
                className="progress-ring"
                style={
                  {
                    "--progress": `${progress * 3.6}deg`,
                    "--ring-color": item.accent,
                  } as React.CSSProperties
                }
              >
                <strong>{progress}%</strong>
              </div>
              <div>
                <p className="eyebrow">YOUR PROGRESS</p>
                <h2>
                  {item.format === "series"
                    ? userState.progress
                      ? `Season ${userState.progress.season}, episode ${userState.progress.episode}`
                      : "Ready to begin"
                    : completed
                      ? "Watched"
                      : "Saved for later"}
                </h2>
                <p>
                  {userState.watchedDates.length
                    ? `Last watched ${new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-2, "day")}`
                    : `Saved ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(userState.savedAt))}`}
                </p>
              </div>
            </div>
            <div className="personal-verdict">
              <p className="eyebrow">YOUR VERDICT</p>
              {userState.verdict ? (
                <>
                  <h2>{formatVerdict(userState.verdict.kind)}</h2>
                  <div>
                    {userState.verdict.qualities.map((quality) => (
                      <span key={quality}>{quality}</span>
                    ))}
                  </div>
                  {userState.verdict.rank && (
                    <p>
                      #{userState.verdict.rank} in your personal film ranking
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2>How did it feel?</h2>
                  <p>One human verdict. No decimal required.</p>
                </>
              )}
              <button type="button" onClick={() => setVerdictOpen(true)}>
                {userState.verdict ? "Refine verdict" : "Add verdict"}{" "}
                <Star size={16} />
              </button>
            </div>
            <div className="personal-note">
              <p className="eyebrow">WHY YOU SAVED IT</p>
              <blockquote>
                {userState.intent?.reason ??
                  "No note yet. Add the context you want to remember."}
              </blockquote>
              {userState.intent?.recommendedBy && (
                <span>Recommended by {userState.intent.recommendedBy}</span>
              )}
              <button
                type="button"
                disabled
                title="Editing notes is coming soon"
              >
                Edit note
              </button>
            </div>
          </section>
        )}

        {item.format === "series" && seasons.length > 0 && (
          <section className="episodes-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">EPISODE TRACKING</p>
                <h2>Episodes</h2>
                <p>One tap to move forward. Every action can be undone.</p>
              </div>
              <div className="season-actions">
                <label>
                  <span className="sr-only">Choose season</span>
                  <select
                    value={season}
                    onChange={(event) => setSeason(Number(event.target.value))}
                  >
                    {seasons.map((entry) => (
                      <option key={entry.number} value={entry.number}>
                        Season {entry.number} · {entry.year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    userState &&
                    dispatch({ type: "complete-season", mediaId: id, season })
                  }
                >
                  Mark season complete
                </button>
              </div>
            </div>
            <div className="episode-list">
              {seasonData?.episodes.map((episode) => {
                const watched = Boolean(
                  userState?.progress &&
                  (userState.progress.season > season ||
                    (userState.progress.season === season &&
                      userState.progress.episode >= episode.number)),
                );
                const isNext =
                  next?.season.number === season &&
                  next.episode?.number === episode.number;
                return (
                  <article
                    className={`${watched ? "watched" : ""} ${isNext ? "next" : ""}`}
                    key={episode.id}
                  >
                    <button
                      type="button"
                      aria-label={`${watched ? "Watched" : "Mark watched"}: episode ${episode.number}, ${episode.title}`}
                      onClick={() => isNext && track()}
                      disabled={!isNext && !watched}
                    >
                      {watched ? (
                        <Check size={16} />
                      ) : isNext ? (
                        <Play size={14} fill="currentColor" />
                      ) : (
                        episode.number
                      )}
                    </button>
                    <div>
                      <p>
                        <span>E{episode.number}</span>
                        <strong>{episode.title}</strong>
                        {isNext && <small>Up next</small>}
                      </p>
                      <span>
                        {episode.runtime} min · {episode.synopsis}
                      </span>
                    </div>
                    {watched && (
                      <button
                        type="button"
                        className="reaction-add"
                        disabled
                        title="Adding reactions is coming soon"
                      >
                        <Plus size={15} />
                        Reaction
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="sentiment-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PUBLIC SENTIMENT</p>
              <h2>What people felt</h2>
              <p>More context than a single average.</p>
            </div>
            <span className={`confidence ${aggregate.confidence}`}>
              {aggregate.confidence} confidence
            </span>
          </div>
          <div className="sentiment-grid">
            <div className="sentiment-main">
              <strong>{aggregate.lovedPercent}%</strong>
              <span>loved it</span>
              <i>
                <b style={{ width: `${aggregate.lovedPercent}%` }} />
              </i>
              <p>12 sample verdicts · weighted until more responses arrive</p>
            </div>
            <div>
              <span>All-timer</span>
              <strong>{aggregate.allTimerPercent}%</strong>
              <p>Most praised: atmosphere, performances, ending</p>
            </div>
            <div>
              <span>Common criticism</span>
              <strong>Slow middle</strong>
              <p>Completion is strong among similar viewers</p>
            </div>
          </div>
        </section>

        <section className="discussion-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <Users size={14} /> FRIENDS’ REACTIONS
              </p>
              <h2>Spoiler-safe by progress</h2>
            </div>
          </div>
          {posts.length ? (
            posts.map((post) => {
              const visible =
                revealed.includes(post.id) ||
                isSpoilerVisible(post.scope, userState?.progress, completed);
              return (
                <article
                  key={post.id}
                  className={!visible ? "spoiler-hidden" : ""}
                >
                  <span className="friend-avatar blue">{post.avatar}</span>
                  <div>
                    <p>
                      <strong>{post.author}</strong>
                      <span>
                        {post.kind} ·{" "}
                        {post.scope.level === "episode"
                          ? `S${post.scope.season} E${post.scope.episode}`
                          : "Whole title"}
                      </span>
                    </p>
                    {visible ? (
                      <blockquote>{post.text}</blockquote>
                    ) : (
                      <div className="spoiler-copy">
                        <LockKeyhole size={16} />
                        <span>Unlocks after episode {post.scope.episode}</span>
                        <button
                          type="button"
                          onClick={() => setRevealed([...revealed, post.id])}
                        >
                          Reveal anyway
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <EyeOff size={24} />
              <h3>No reactions have unlocked yet.</h3>
              <p>
                Your friends’ thoughts will appear when your progress is safe.
              </p>
            </div>
          )}
        </section>

        <section className="credits-section">
          <div>
            <p className="eyebrow">CREATED BY</p>
            <h2>{item.creators.join(", ") || "Creator information pending"}</h2>
            <p>
              {item.cast.length
                ? `With ${item.cast.join(", ")}`
                : "Cast information pending"}
            </p>
          </div>
          <div>
            <History size={20} />
            <p>
              <strong>Watch history</strong>
              <span>
                {userState?.watchedDates.length ?? 0} recorded{" "}
                {userState?.watchedDates.length === 1 ? "date" : "dates"}
              </span>
            </p>
          </div>
        </section>
      </div>
      <VerdictModal
        open={verdictOpen}
        title={item.title}
        initial={userState?.verdict?.kind}
        onClose={() => setVerdictOpen(false)}
        onSave={(kind, qualities, tags, rank) =>
          dispatch({
            type: "verdict",
            mediaId: id,
            kind,
            qualities,
            tags,
            rank,
          })
        }
      />
    </div>
  );
}
