import {
  ArrowRight,
  Film,
  Map,
  Repeat2,
  Share2,
  Sparkles,
  Tv,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasTmdbCatalog } from "../data";
import {
  formatVerdict,
  libraryOverview,
  tasteCloud,
  topFavourites,
} from "../domain";
import { useStore } from "../store";

export function Profile() {
  const { state, catalog } = useStore();
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.email?.split("@")[0];
  const hasTmdbArtwork =
    hasTmdbCatalog || catalog.some((item) => item.provider?.name === "tmdb");
  const overview = libraryOverview(state.userMedia, state.events, catalog);
  const favourites = topFavourites(state.userMedia, catalog, 4);
  const definingFavourite = favourites[0];
  const definingFavouriteState = definingFavourite
    ? state.userMedia[definingFavourite.id]
    : undefined;
  const cloud = tasteCloud(state.userMedia, catalog);
  return (
    <div className="page profile-page">
      <section
        className="profile-hero"
        style={
          {
            "--profile-image": definingFavourite
              ? `url(${definingFavourite.backdrop})`
              : "none",
          } as React.CSSProperties
        }
      >
        <div className="profile-identity">
          <span className="profile-avatar">
            {user?.email?.slice(0, 2).toUpperCase() ?? "—"}
          </span>
          <div>
            <p className="eyebrow">{displayName ?? "YOUR PROFILE"}</p>
            <h1>A home for stories that linger.</h1>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled
          title="Coming soon"
        >
          <Share2 size={17} />
          Share profile
        </button>
        <div className="profile-stats">
          <span>
            <strong>{overview.totalWatched}</strong>watched
          </span>
          <span>
            <strong>{overview.watchedThisYear}</strong>this year
          </span>
          <span>
            <strong>{overview.totalHours}h</strong>in stories
          </span>
          <span>
            <strong>{overview.totalRewatches}</strong>rewatches
          </span>
        </div>
      </section>
      {definingFavourite ? (
        <section className="profile-featured">
          <div className="featured-copy">
            <p className="eyebrow">DEFINING FAVOURITE</p>
            <h2>{definingFavourite.title}</h2>
            <div>
              {definingFavouriteState?.verdict && (
                <span>
                  {formatVerdict(definingFavouriteState.verdict.kind)}
                </span>
              )}
              {definingFavouriteState?.verdict?.rank && (
                <span>#{definingFavouriteState.verdict.rank} film</span>
              )}
              {(definingFavouriteState?.watchedDates.length ?? 0) > 1 && (
                <span>
                  Watched {definingFavouriteState!.watchedDates.length} times
                </span>
              )}
            </div>
            <Link to={`/title/${definingFavourite.id}`}>
              Open story <ArrowRight size={16} />
            </Link>
          </div>
          <img
            src={definingFavourite.poster}
            alt={`${definingFavourite.title} editorial artwork`}
          />
        </section>
      ) : (
        <section className="profile-featured empty-state">
          <h3>No defining favourite yet</h3>
          <p>Record a Verdict on a title to feature it here.</p>
        </section>
      )}
      <section className="profile-grid">
        <div className="taste-dna-card">
          <header>
            <div>
              <p className="eyebrow">
                <Sparkles size={14} /> TASTE DNA
              </p>
              <h2>Coming soon</h2>
              <p>
                Taste DNA needs enough recorded Verdicts to find a real pattern
                in your taste. It isn&rsquo;t live yet, so nothing is shown here
                rather than a guess.
              </p>
            </div>
          </header>
          <footer>
            <button type="button" disabled title="Coming soon">
              Why we think this <ArrowRight size={15} />
            </button>
          </footer>
        </div>
        <aside className="year-card">
          <p className="eyebrow">{new Date().getFullYear()} SO FAR</p>
          <h2>
            {overview.watchedThisYear} stories,
            <br />
            {overview.favouritesThisYear} new favourites.
          </h2>
          <div className="year-ring">
            <strong>{overview.hoursThisYear}h</strong>
            <span>watched</span>
          </div>
          <ul>
            <li>
              <Film size={17} />
              <span>
                <strong>{overview.filmsThisYear}</strong> films
              </span>
            </li>
            <li>
              <Tv size={17} />
              <span>
                <strong>{overview.seriesThisYear}</strong> series
              </span>
            </li>
            <li>
              <Repeat2 size={17} />
              <span>
                <strong>{overview.rewatchesThisYear}</strong> rewatches
              </span>
            </li>
          </ul>
          <button type="button" disabled title="Coming soon">
            Open year in review <ArrowRight size={15} />
          </button>
        </aside>
      </section>
      <section className="ranked-favourites">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PERSONAL CANON</p>
            <h2>Stories that define your taste</h2>
            <p>Ordered by your comparisons, never by a public average.</p>
          </div>
          <button type="button" disabled title="Coming soon">
            Edit ranking
          </button>
        </div>
        {favourites.length > 0 ? (
          <div>
            {favourites.map((item, index) => (
              <Link
                to={`/title/${item.id}`}
                key={item.id}
                className={index === 0 ? "large" : ""}
              >
                <img src={item.poster} alt={item.title} />
                <span className="rank-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {state.userMedia[item.id]?.verdict
                      ? formatVerdict(state.userMedia[item.id]!.verdict!.kind)
                      : "Favourite"}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No personal canon yet</h3>
            <p>Record verdicts on titles you love to build this list.</p>
          </div>
        )}
      </section>
      <section className="taste-summary">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR VIEWING SHAPE</p>
            <h2>Taste map</h2>
          </div>
          <Link to="/library">
            Explore full map <Map size={16} />
          </Link>
        </div>
        {cloud.length > 0 ? (
          <div className="taste-cloud">
            {cloud.map((tag) => (
              <span key={tag.label} className={`cloud-${tag.size}`}>
                {tag.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Nothing to map yet</h3>
            <p>Add titles to your library to see your taste take shape.</p>
          </div>
        )}
      </section>
      {hasTmdbArtwork ? (
        <footer className="art-credit tmdb-credit">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer"
            aria-label="Visit The Movie Database"
          >
            <img
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
              alt="TMDB"
              width="40"
              height="29"
            />
          </a>
          <span>
            This product uses TMDB and the TMDB APIs but is not endorsed,
            certified, or otherwise approved by TMDB.
          </span>
        </footer>
      ) : (
        <p className="art-credit">
          Demo editorial imagery provided by Unsplash. Media metadata is local
          demonstration data.
        </p>
      )}
    </div>
  );
}
