import {
  ArrowRight,
  Eye,
  Film,
  Map,
  Repeat2,
  Share2,
  Sparkles,
  Tv,
} from "lucide-react";
import { Link } from "react-router-dom";
import { hasTmdbCatalog } from "../data";
import { formatVerdict } from "../domain";
import { useStore } from "../store";

const dna = [
  {
    left: "Plot-led",
    right: "Character-led",
    value: 68,
    confidence: "Strong signal",
  },
  { left: "Fast", right: "Patient", value: 79, confidence: "Strong signal" },
  { left: "Light", right: "Dark", value: 62, confidence: "Developing" },
  {
    left: "Accessible",
    right: "Experimental",
    value: 71,
    confidence: "Strong signal",
  },
  { left: "Resolved", right: "Ambiguous", value: 66, confidence: "Developing" },
];

export function Profile() {
  const { state, catalog } = useStore();
  const hasTmdbArtwork =
    hasTmdbCatalog || catalog.some((item) => item.provider?.name === "tmdb");
  const favourites = catalog.filter((item) =>
    ["arrival", "dune-part-two", "dark", "poor-things"].includes(item.id),
  );
  return (
    <div className="page profile-page">
      <section
        className="profile-hero"
        style={
          {
            "--profile-image": `url(${catalog.find((item) => item.id === "arrival")?.backdrop})`,
          } as React.CSSProperties
        }
      >
        <div className="profile-identity">
          <span className="profile-avatar">AK</span>
          <div>
            <p className="eyebrow">ALEX KIM</p>
            <h1>A home for stories that linger.</h1>
            <p>Oslo · watching thoughtfully since 2018</p>
          </div>
        </div>
        <button className="secondary-button" type="button">
          <Share2 size={17} />
          Share profile
        </button>
        <div className="profile-stats">
          <span>
            <strong>486</strong>watched
          </span>
          <span>
            <strong>74</strong>this year
          </span>
          <span>
            <strong>1,032h</strong>in stories
          </span>
          <span>
            <strong>18</strong>rewatches
          </span>
        </div>
      </section>
      <section className="profile-featured">
        <div className="featured-copy">
          <p className="eyebrow">DEFINING FAVOURITE</p>
          <h2>Arrival</h2>
          <blockquote>
            “The rare film that changes shape every time I return to it.”
          </blockquote>
          <div>
            <span>All-timer</span>
            <span>#1 film</span>
            <span>Rewatched twice</span>
          </div>
          <Link to="/title/arrival">
            Open story <ArrowRight size={16} />
          </Link>
        </div>
        <img
          src={catalog.find((item) => item.id === "arrival")?.poster}
          alt="Arrival editorial artwork"
        />
      </section>
      <section className="profile-grid">
        <div className="taste-dna-card">
          <header>
            <div>
              <p className="eyebrow">
                <Sparkles size={14} /> TASTE DNA
              </p>
              <h2>Patient stories. Human stakes.</h2>
              <p>
                Your strongest pattern is atmosphere in service of character—not
                spectacle by itself.
              </p>
            </div>
            <button type="button" aria-label="See how taste DNA works">
              <Eye size={18} />
            </button>
          </header>
          <div className="dna-list">
            {dna.map((item) => (
              <div key={item.left}>
                <p>
                  <span>{item.left}</span>
                  <small>{item.confidence}</small>
                  <span>{item.right}</span>
                </p>
                <i>
                  <b style={{ left: `${item.value}%` }} />
                </i>
              </div>
            ))}
          </div>
          <footer>
            <span>Built from 143 confident verdicts</span>
            <button type="button">
              Why we think this <ArrowRight size={15} />
            </button>
          </footer>
        </div>
        <aside className="year-card">
          <p className="eyebrow">2026 SO FAR</p>
          <h2>
            Thirty-seven stories,
            <br />
            five new favourites.
          </h2>
          <div className="year-ring">
            <strong>126h</strong>
            <span>watched</span>
          </div>
          <ul>
            <li>
              <Film size={17} />
              <span>
                <strong>24</strong> films
              </span>
            </li>
            <li>
              <Tv size={17} />
              <span>
                <strong>13</strong> series
              </span>
            </li>
            <li>
              <Repeat2 size={17} />
              <span>
                <strong>4</strong> rewatches
              </span>
            </li>
          </ul>
          <button type="button">
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
          <button type="button">Edit ranking</button>
        </div>
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
        <div className="taste-cloud">
          <span className="cloud-large">Atmospheric</span>
          <span className="cloud-medium">Science fiction</span>
          <span className="cloud-small">Korean cinema</span>
          <span className="cloud-large serif">Character-led</span>
          <span className="cloud-small">Slow burn</span>
          <span className="cloud-medium serif">Quietly devastating</span>
          <span className="cloud-small">2010s</span>
          <span className="cloud-medium">Ambiguous endings</span>
        </div>
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
