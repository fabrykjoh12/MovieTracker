import { ArrowRight, Clock3, Compass, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { media } from "../data";
import { PosterCard } from "../components/PosterCard";
import { recommendationReason } from "../domain";
import { useStore } from "../store";

export function Discover() {
  const { state, dispatch } = useStore();
  const featured = media.find((item) => item.id === "perfect-days")!;
  const collection = media.filter((item) =>
    ["aftersun", "portrait", "memories-of-murder", "past-lives"].includes(
      item.id,
    ),
  );
  const recommendations = media.filter((item) =>
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
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">JUST FOR YOU</p>
            <h2>Three considered matches</h2>
            <p>Based on verdicts, pacing and what you actually finish.</p>
          </div>
        </div>
        <div className="poster-grid three-up">
          {recommendations.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              userState={state.userMedia[item.id]}
              reason={recommendationReason(item, state.userMedia[item.id])}
              onAdd={() => dispatch({ type: "add", mediaId: item.id })}
              onTrack={() => dispatch({ type: "mark-next", mediaId: item.id })}
            />
          ))}
        </div>
      </section>
      <section className="collection-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EDITORIAL COLLECTION</p>
            <h2>Films that echo afterward</h2>
            <p>
              Quietly devastating stories where the final frame changes
              everything before it.
            </p>
          </div>
          <Link to="/library">
            Save collection <ArrowRight size={15} />
          </Link>
        </div>
        <div className="collection-ribbon">
          {collection.map((item, index) => (
            <Link
              to={`/title/${item.id}`}
              key={item.id}
              className="collection-item"
            >
              <span>0{index + 1}</span>
              <img src={item.poster} alt={`${item.title} artwork`} />
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
