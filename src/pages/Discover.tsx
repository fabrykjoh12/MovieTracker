import {
  AlertCircle,
  ArrowRight,
  BookmarkPlus,
  Check,
  Clock3,
  Compass,
  Film,
  LoaderCircle,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Tv,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MediaCard } from "../components/MediaCard";
import { Poster } from "../components/Poster";
import { SectionHeader } from "../components/SectionHeader";
import { recommendationReason } from "../domain";
import {
  catalogResultKey,
  catalogResultLocalId,
  useCatalogSearch,
} from "../hooks/useCatalogSearch";
import type { Media, UserMediaState } from "../types";
import { useStore } from "../store";

function pickActionLabel(item: Media, userState?: UserMediaState) {
  if (!userState) return "Add to library";
  if (item.format === "series") return "Next episode";
  return userState.status === "completed" ? "Watched" : "Log watched";
}

export function Discover() {
  const { state, dispatch, catalog } = useStore();
  const {
    configured,
    query,
    setQuery,
    format,
    setFormat,
    searchState,
    results,
    searchMessage,
    busyKey,
    addToLibrary,
  } = useCatalogSearch();
  const featured = catalog.find((item) => item.id === "perfect-days")!;
  const collection = catalog.filter((item) =>
    ["aftersun", "portrait", "memories-of-murder", "past-lives"].includes(
      item.id,
    ),
  );
  const recommendations = catalog.filter((item) =>
    ["decision-to-leave", "columbus", "perfect-days"].includes(item.id),
  );

  return (
    <div className="page discover-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">FIND YOUR NEXT STORY</p>
          <h1>Discover</h1>
          <p>Curated paths in. Every recommendation has a reason.</p>
        </div>
        <button className="secondary-button" type="button">
          <SlidersHorizontal size={17} />
          All filters
        </button>
      </header>

      <section
        className="catalog-search"
        aria-labelledby="catalog-search-title"
      >
        <SectionHeader
          label="THE WHOLE CATALOG"
          title="Find a specific story"
        />
        {configured ? (
          <>
            <div className="catalog-search-bar">
              <label>
                <span className="sr-only">Search movies and series</span>
                <Search size={20} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by title"
                  autoComplete="off"
                />
                {searchState === "searching" && (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                )}
              </label>
              <div className="catalog-format" aria-label="Search format">
                {(["any", "movie", "series"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={format === value ? "selected" : ""}
                    onClick={() => setFormat(value)}
                    aria-pressed={format === value}
                  >
                    {value === "movie" ? (
                      <Film size={15} />
                    ) : value === "series" ? (
                      <Tv size={15} />
                    ) : null}
                    {value === "any"
                      ? "All"
                      : value === "movie"
                        ? "Movies"
                        : "Series"}
                  </button>
                ))}
              </div>
            </div>
            <p
              className={`catalog-search-status ${searchState}`}
              role="status"
              aria-live="polite"
            >
              {searchMessage || "Type at least two characters to search."}
            </p>
            {results.length > 0 && (
              <div className="catalog-results">
                {results.map((result) => {
                  const localId = catalogResultLocalId(result);
                  const saved = Boolean(state.userMedia[localId]);
                  const busy = busyKey === catalogResultKey(result);
                  return (
                    <article key={catalogResultKey(result)}>
                      {result.poster ? (
                        <img
                          src={result.poster}
                          alt=""
                          width="160"
                          height="240"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="catalog-art-fallback"
                          aria-hidden="true"
                        >
                          {result.format === "movie" ? (
                            <Film size={28} />
                          ) : (
                            <Tv size={28} />
                          )}
                        </div>
                      )}
                      <div>
                        <p>
                          <span>{result.format}</span>
                          <span>{result.year ?? "Date pending"}</span>
                        </p>
                        <h3>{result.title}</h3>
                        {result.originalTitle && (
                          <small>{result.originalTitle}</small>
                        )}
                        <p>{result.synopsis}</p>
                      </div>
                      {saved ? (
                        <Link
                          className="catalog-result-action"
                          to={`/title/${localId}`}
                        >
                          <Check size={16} />
                          In library
                        </Link>
                      ) : (
                        <button
                          className="catalog-result-action"
                          type="button"
                          disabled={busy || busyKey !== undefined}
                          onClick={() => void addToLibrary(result)}
                        >
                          {busy ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : (
                            <Plus size={16} />
                          )}
                          {busy ? "Preparing" : "Add"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="catalog-search-unavailable" role="status">
            <AlertCircle size={19} />
            <div>
              <strong>Catalog search is ready to connect.</strong>
              <span>
                Curated discovery still works while the secure search service is
                being deployed.
              </span>
            </div>
          </div>
        )}
      </section>

      <section
        className="editorial-hero"
        style={
          {
            "--editorial-image": `url(${featured.backdrop})`,
          } as React.CSSProperties
        }
      >
        <div className="editorial-copy">
          <p className="eyebrow">THIS WEEK’S QUIET FIND</p>
          <h2>{featured.title}</h2>
          <p>
            A small, patient film about the radical pleasure of paying
            attention.
          </p>
          <div className="hero-meta">
            <span>
              <Clock3 size={15} />
              {featured.runtime} min
            </span>
            <span>{featured.country}</span>
            <span>{featured.services[0]}</span>
          </div>
          <div className="hero-actions">
            <Link className="primary-button" to={`/title/${featured.id}`}>
              Explore film <ArrowRight size={17} />
            </Link>
            <button
              className="secondary-button"
              type="button"
              onClick={() => dispatch({ type: "add", mediaId: featured.id })}
            >
              {state.userMedia[featured.id]
                ? "In your library"
                : "Save for later"}
            </button>
          </div>
        </div>
      </section>

      <section className="discover-section">
        <SectionHeader label="JUST FOR YOU" title="Three considered matches" />
        <div className="three-up">
          {recommendations.map((item) => {
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
                    aria-label={
                      userState
                        ? `Track ${item.title}`
                        : `Add ${item.title} to library`
                    }
                  >
                    {userState ? (
                      <Play size={15} />
                    ) : (
                      <BookmarkPlus size={15} />
                    )}
                    {pickActionLabel(item, userState)}
                  </button>
                }
              />
            );
          })}
        </div>
      </section>

      <section className="discover-section collection-section">
        <SectionHeader
          label="EDITORIAL COLLECTION"
          title="Films that echo afterward"
          action={{ text: "Save collection", to: "/library" }}
        />
        <div className="collection-ribbon">
          {collection.map((item, index) => (
            <Link
              to={`/title/${item.id}`}
              key={item.id}
              className="collection-item"
            >
              <span>0{index + 1}</span>
              <Poster src={item.poster} alt={`${item.title} poster`} />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.year} · {item.country}
                </small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="discovery-paths">
        <article>
          <Compass size={22} />
          <p className="eyebrow">EXPLORE BY MOOD</p>
          <h3>Something atmospheric</h3>
          <p>Patient, immersive stories with a strong sense of place.</p>
          <Link to="/discover">
            13 titles <ArrowRight size={15} />
          </Link>
        </article>
        <article>
          <Clock3 size={22} />
          <p className="eyebrow">UNDER 100 MINUTES</p>
          <h3>Complete stories, light footprint</h3>
          <p>Shorter films that never feel slight.</p>
          <Link to="/discover">
            21 titles <ArrowRight size={15} />
          </Link>
        </article>
      </section>
    </div>
  );
}
