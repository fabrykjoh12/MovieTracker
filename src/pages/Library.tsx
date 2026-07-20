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
  Play,
  Plus,
  Rows3,
  Search,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatVerdict, statusLabel } from "../domain";
import { MediaCard } from "../components/MediaCard";
import { Poster } from "../components/Poster";
import { SectionHeader } from "../components/SectionHeader";
import { mediaActionLabel } from "../lib/mediaActionLabel";
import { useStore } from "../store";
import type { LibraryStatus, Media } from "../types";

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
  const { state, dispatch, catalog } = useStore();
  const [view, setView] = useState<View>("shelves");
  const [status, setStatus] = useState<LibraryStatus | "all">("all");
  const [query, setQuery] = useState("");
  const libraryMedia = useMemo(
    () =>
      catalog.filter((item) => {
        const userState = state.userMedia[item.id];
        return (
          userState &&
          (status === "all" || userState.status === status) &&
          item.title.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [catalog, query, state.userMedia, status],
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
        <div className="health-lead">
          <span className="health-score">82</span>
          <div>
            <p className="eyebrow">WATCHLIST HEALTH</p>
            <strong>Focused and useful</strong>
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
  const { state, catalog } = useStore();
  return (
    <section className="shelves-view" aria-label="Your shelves">
      {state.shelves.map((shelf) => {
        const featured = catalog.find((item) => item.id === shelf.featuredId);
        const shelfMedia = shelf.mediaIds
          .map((id) => catalog.find((item) => item.id === id))
          .filter((item): item is Media => Boolean(item));
        return (
          <article className="shelf-card" key={shelf.id}>
            <div className="shelf-card-head">
              <span className="shelf-visibility">{shelf.visibility}</span>
              <span className="shelf-count">
                {shelf.mediaIds.length} stories
              </span>
            </div>
            <h3 className="shelf-title">{shelf.title}</h3>
            <p className="shelf-desc">{shelf.description}</p>
            <div className="shelf-strip">
              {shelfMedia.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  to={`/title/${item.id}`}
                  className="shelf-strip-item"
                  aria-label={item.title}
                >
                  <Poster src={item.poster} alt={`${item.title} poster`} />
                </Link>
              ))}
            </div>
            <Link className="shelf-open" to={`/title/${featured?.id}`}>
              Open shelf <ChevronRight size={16} />
            </Link>
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
  items: Media[];
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
        <div className="gallery-grid">
          {items.map((item) => {
            const userState = state.userMedia[item.id];
            return (
              <MediaCard
                key={item.id}
                title={item.title}
                to={`/title/${item.id}`}
                poster={item.poster}
                pill={userState ? statusLabel(userState.status) : undefined}
                meta={`${item.year} · ${
                  item.format === "movie"
                    ? `${item.runtime} min`
                    : `${item.seasons?.length ?? 0} seasons`
                }`}
                footer={
                  userState ? (
                    <button
                      type="button"
                      className="card-action"
                      onClick={() =>
                        dispatch({ type: "mark-next", mediaId: item.id })
                      }
                      aria-label={`${mediaActionLabel(item, userState)} — ${item.title}`}
                    >
                      <Play size={15} />
                      {mediaActionLabel(item, userState)}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
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
  const { state, dispatch, catalog } = useStore();
  return (
    <section className="queue-view">
      <SectionHeader label="DELIBERATE, NOT ENDLESS" title="Your next four" />
      <ol>
        {state.queue.map((id, index) => {
          const item = catalog.find((entry) => entry.id === id);
          if (!item) return null;
          return (
            <li key={id}>
              <span className="queue-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="queue-art">
                <Poster src={item.poster} alt={`${item.title} poster`} />
              </div>
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
  const { state, catalog } = useStore();
  return (
    <section className="timeline-view">
      <SectionHeader label="VIEWING DIARY" title="Recent chapters" />
      {state.events
        .slice()
        .reverse()
        .map((event) => {
          const item = catalog.find((entry) => entry.id === event.mediaId);
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
                <div className="timeline-art">
                  <Poster src={item.poster} alt={`${item.title} poster`} />
                </div>
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
  const { catalog } = useStore();
  const dates = Array.from({ length: 14 }, (_, i) => ({
    day: 13 + i,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
  }));
  return (
    <section className="calendar-view">
      <SectionHeader label="JULY 2026" title="Past watches & future stories" />
      <div className="calendar-grid">
        {dates.map((date, index) => (
          <div className={index === 3 ? "today" : ""} key={date.day}>
            <span>{date.weekday}</span>
            <strong>{date.day}</strong>
            {index === 3 && <small>Today</small>}
            {index === 4 && (
              <Link to="/title/severance">
                <img
                  src={catalog.find((item) => item.id === "severance")?.poster}
                  alt="Severance"
                />
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
  const { state, catalog } = useStore();
  const groups = ["all-timer", "loved", "liked", "mixed"] as const;
  return (
    <section className="taste-view">
      <SectionHeader
        label="PERSONAL ORDER, NOT PUBLIC SCORE"
        title="Your taste map"
      />
      {groups.map((kind) => {
        const items = catalog.filter(
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
