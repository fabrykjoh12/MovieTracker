import { useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Clock3,
  Grid2X2,
  Heart,
  ListOrdered,
  Plus,
  Rows3,
  Search,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { media } from "../data";
import { formatVerdict, statusLabel } from "../domain";
import { PosterCard } from "../components/PosterCard";
import { useStore } from "../store";
import type { LibraryStatus } from "../types";

type View = "shelves" | "gallery" | "queue" | "timeline" | "calendar" | "taste";
const demoNow = Date.parse("2026-07-16T20:00:00.000Z");
const views: { id: View; label: string; icon: typeof Rows3 }[] = [
  { id: "shelves", label: "Shelves", icon: Rows3 },
  { id: "gallery", label: "Gallery", icon: Grid2X2 },
  { id: "queue", label: "Queue", icon: ListOrdered },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "taste", label: "Taste Map", icon: Sparkles },
];

export function Library() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<View>("shelves");
  const [status, setStatus] = useState<LibraryStatus | "all">("all");
  const [query, setQuery] = useState("");
  const libraryMedia = useMemo(
    () =>
      media.filter((item) => {
        const userState = state.userMedia[item.id];
        return (
          userState &&
          (status === "all" || userState.status === status) &&
          item.title.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [query, state.userMedia, status],
  );
  const stale = Object.values(state.userMedia).filter(
    (item) =>
      item.status === "planned" &&
      demoNow - Date.parse(item.savedAt) > 150 * 86400000,
  ).length;

  return (
    <div className="page library-page">
      <header className="page-title-row library-title">
        <div>
          <p className="eyebrow">YOUR LIFE IN STORIES</p>
          <h1>Library</h1>
          <p>
            {Object.keys(state.userMedia).length} titles · {state.queue.length}{" "}
            deliberately up next
          </p>
        </div>
        <button className="primary-button" type="button">
          <Plus size={18} />
          New shelf
        </button>
      </header>

      <section className="library-health" aria-label="Library health">
        <div>
          <span className="health-score">82</span>
          <div>
            <p className="eyebrow">WATCHLIST HEALTH</p>
            <strong>Focused and useful</strong>
            <span>Your queue is short enough to choose from.</span>
          </div>
        </div>
        <div className="health-items">
          <span>
            <strong>{state.queue.length}</strong> Up next
          </span>
          <span>
            <strong>{stale}</strong> Ready to revisit
          </span>
          <button type="button">
            <Sparkles size={16} />
            Pick for me
          </button>
        </div>
      </section>

      <div className="library-toolbar">
        <div className="view-tabs" role="tablist" aria-label="Library view">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "active" : ""}
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        <label className="library-search">
          <Search size={17} />
          <span className="sr-only">Search your library</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library"
          />
        </label>
      </div>

      {view === "shelves" && <ShelvesView />}
      {view === "gallery" && (
        <GalleryView
          items={libraryMedia}
          status={status}
          setStatus={setStatus}
        />
      )}
      {view === "queue" && <QueueView />}
      {view === "timeline" && <TimelineView />}
      {view === "calendar" && <CalendarView />}
      {view === "taste" && <TasteView />}

      <section className="stale-callout">
        <Archive size={24} />
        <div>
          <p className="eyebrow">A GENTLE CLEAN-UP</p>
          <h2>Three titles have been waiting a while.</h2>
          <p>
            Your history stays intact. Archive them now and they can return when
            the timing is right.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            ["aftersun", "portrait"].forEach((mediaId) =>
              dispatch({ type: "status", mediaId, status: "archived" }),
            )
          }
        >
          Review forgotten saves
        </button>
      </section>
    </div>
  );
}

function ShelvesView() {
  const { state } = useStore();
  return (
    <section className="shelves-view" aria-label="Your shelves">
      {state.shelves.map((shelf, index) => {
        const featured = media.find((item) => item.id === shelf.featuredId);
        const shelfMedia = shelf.mediaIds
          .map((id) => media.find((item) => item.id === id))
          .filter(Boolean);
        return (
          <article
            className={`shelf-card shelf-${index + 1}`}
            key={shelf.id}
            style={
              {
                "--shelf-tone": shelf.atmosphere,
                "--shelf-image": `url(${featured?.backdrop})`,
              } as React.CSSProperties
            }
          >
            <div className="shelf-copy">
              <span className="shelf-visibility">{shelf.visibility}</span>
              <h2>{shelf.title}</h2>
              <p>{shelf.description}</p>
              <Link to={`/title/${featured?.id}`}>
                Open shelf <ChevronRight size={16} />
              </Link>
            </div>
            <div className="shelf-posters">
              {shelfMedia.map(
                (item, itemIndex) =>
                  item && (
                    <Link
                      key={item.id}
                      to={`/title/${item.id}`}
                      style={{ "--i": itemIndex } as React.CSSProperties}
                    >
                      <img src={item.poster} alt={item.title} />
                    </Link>
                  ),
              )}
            </div>
            <span className="shelf-count">{shelf.mediaIds.length} stories</span>
          </article>
        );
      })}
    </section>
  );
}

function GalleryView({
  items,
  status,
  setStatus,
}: {
  items: typeof media;
  status: LibraryStatus | "all";
  setStatus: (status: LibraryStatus | "all") => void;
}) {
  const { state, dispatch } = useStore();
  const statuses: (LibraryStatus | "all")[] = [
    "all",
    "watching",
    "up-next",
    "planned",
    "paused",
    "completed",
    "archived",
  ];
  return (
    <section>
      <div className="status-filters">
        {statuses.map((value) => (
          <button
            type="button"
            className={status === value ? "selected" : ""}
            key={value}
            onClick={() => setStatus(value)}
          >
            {value === "all" ? "All stories" : statusLabel(value)}
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="poster-grid gallery-grid">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              userState={state.userMedia[item.id]}
              onTrack={() => dispatch({ type: "mark-next", mediaId: item.id })}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart size={28} />
          <h3>Nothing in this corner yet.</h3>
          <p>Try another state or save something new from Discover.</p>
        </div>
      )}
    </section>
  );
}

function QueueView() {
  const { state, dispatch } = useStore();
  return (
    <section className="queue-view">
      <header>
        <div>
          <p className="eyebrow">DELIBERATE, NOT ENDLESS</p>
          <h2>Your next four</h2>
          <p>
            Move a title when your mood changes. The top spot is tonight’s
            default.
          </p>
        </div>
      </header>
      <ol>
        {state.queue.map((id, index) => {
          const item = media.find((entry) => entry.id === id);
          if (!item) return null;
          return (
            <li key={id}>
              <span className="queue-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <img src={item.poster} alt="" />
              <div>
                <h3>
                  <Link to={`/title/${item.id}`}>{item.title}</Link>
                </h3>
                <p>
                  {item.format === "movie"
                    ? `${item.runtime} min`
                    : `${item.seasons?.length} seasons`}{" "}
                  · {item.services[0]}
                </p>
                <small>
                  {state.userMedia[id]?.intent?.reason ??
                    item.moods.slice(0, 2).join(" · ")}
                </small>
              </div>
              <span className="queue-mood">
                {state.userMedia[id]?.intent?.mood ?? item.moods[0]}
              </span>
              <div className="queue-controls">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() =>
                    dispatch({ type: "queue", mediaId: id, direction: -1 })
                  }
                  aria-label={`Move ${item.title} up`}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  disabled={index === state.queue.length - 1}
                  onClick={() =>
                    dispatch({ type: "queue", mediaId: id, direction: 1 })
                  }
                  aria-label={`Move ${item.title} down`}
                >
                  <ArrowDown size={17} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TimelineView() {
  const { state } = useStore();
  return (
    <section className="timeline-view">
      <header>
        <p className="eyebrow">VIEWING DIARY</p>
        <h2>Recent chapters</h2>
      </header>
      {state.events
        .slice()
        .reverse()
        .map((event) => {
          const item = media.find((entry) => entry.id === event.mediaId);
          return (
            item && (
              <article key={event.id}>
                <time>
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(event.watchedAt))}
                </time>
                <i />
                <img src={item.poster} alt="" />
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {event.type === "episode"
                      ? `Season ${event.season}, episode ${event.episode}`
                      : event.type === "rewatch"
                        ? "Rewatched"
                        : "Watched"}
                  </p>
                </div>
                {state.userMedia[item.id]?.verdict && (
                  <span>
                    {formatVerdict(state.userMedia[item.id]!.verdict!.kind)}
                  </span>
                )}
              </article>
            )
          );
        })}
    </section>
  );
}

function CalendarView() {
  const dates = Array.from({ length: 14 }, (_, i) => ({
    day: 13 + i,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
  }));
  return (
    <section className="calendar-view">
      <header>
        <div>
          <p className="eyebrow">JULY 2026</p>
          <h2>Past watches & future stories</h2>
        </div>
      </header>
      <div className="calendar-grid">
        {dates.map((date, index) => (
          <div className={index === 3 ? "today" : ""} key={date.day}>
            <span>{date.weekday}</span>
            <strong>{date.day}</strong>
            {index === 3 && <small>Today</small>}
            {index === 4 && (
              <Link to="/title/severance">
                <img src={media[0]?.poster} alt="Severance" />
                <span>New episode</span>
              </Link>
            )}
            {index === 6 && (
              <Link to="/friends">
                <UsersIcon /> <span>Friday film</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function UsersIcon() {
  return <span className="calendar-people">3</span>;
}

function TasteView() {
  const { state } = useStore();
  const groups = ["all-timer", "loved", "liked", "mixed"] as const;
  return (
    <section className="taste-view">
      <header>
        <p className="eyebrow">PERSONAL ORDER, NOT PUBLIC SCORE</p>
        <h2>Your taste map</h2>
        <p>
          Titles are grouped by your emotional verdict, then ordered only as
          precisely as your comparisons support.
        </p>
      </header>
      {groups.map((kind) => {
        const items = media.filter(
          (item) => state.userMedia[item.id]?.verdict?.kind === kind,
        );
        return (
          <div className="taste-row" key={kind}>
            <div>
              <strong>{formatVerdict(kind)}</strong>
              <span>{items.length} titles</span>
            </div>
            <div>
              {items.map((item) => (
                <Link to={`/title/${item.id}`} key={item.id}>
                  <img src={item.poster} alt={item.title} />
                  <span>#{state.userMedia[item.id]?.verdict?.rank ?? "—"}</span>
                </Link>
              ))}
              {!items.length && <p>Room for a future favourite.</p>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
