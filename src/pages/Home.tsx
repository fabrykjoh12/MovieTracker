import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Info,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  nextEpisode,
  progressPercent,
  recommendationReason,
  tonightCandidates,
} from "../domain";
import { PosterCard } from "../components/PosterCard";
import { TonightControls } from "../components/TonightControls";
import { useStore } from "../store";

export function Home() {
  const { state, dispatch, catalog } = useStore();
  const hero = catalog.find((item) => item.id === "severance")!;
  const heroState = state.userMedia[hero.id];
  const upcoming = nextEpisode(hero, heroState?.progress);
  const picks = tonightCandidates(catalog, state);
  const progress = progressPercent(hero, heroState?.progress);

  const trackHero = () => dispatch({ type: "mark-next", mediaId: hero.id });

  return (
    <div className="page home-page">
      <section className="welcome-line">
        <div>
          <p className="eyebrow">THURSDAY, JULY 16</p>
          <h1>Good evening, Alex.</h1>
        </div>
        <p>One episode waiting. A quiet night to fill.</p>
      </section>

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
              S{upcoming?.season.number} E{upcoming?.episode?.number}
            </strong>
            <span>{upcoming?.episode?.title}</span>
          </div>
          <p className="hero-description">{upcoming?.episode?.synopsis}</p>
          <div className="hero-meta">
            <span>
              <Clock3 size={15} />
              {upcoming?.episode?.runtime} min
            </span>
            <span className="service-mark">tv+</span>
            <span>Last watched 2 days ago</span>
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
                {upcoming?.season.episodes.length}
              </span>
              <span>{progress}% overall</span>
            </div>
            <i>
              <b
                style={{
                  width: `${((heroState?.progress?.episode ?? 0) / (upcoming?.season.episodes.length ?? 1)) * 100}%`,
                }}
              />
            </i>
          </div>
        </div>
        <div className="hero-episode-card">
          <p>UP AFTER THIS</p>
          <span>S2 E{(upcoming?.episode?.number ?? 0) + 1}</span>
          <strong>
            {upcoming?.season.episodes[upcoming?.episode?.number ?? 0]?.title ??
              "The next chapter"}
          </strong>
        </div>
      </section>

      <div className="section-heading tonight-heading">
        <div>
          <p className="eyebrow">THREE, NOT THIRTY</p>
          <h2>Tonight’s picks</h2>
          <p>A focused shortlist shaped by your time, mood and services.</p>
        </div>
        <Sparkles size={23} aria-hidden="true" />
      </div>
      <TonightControls />
      <section className="tonight-grid" aria-label="Tonight's recommendations">
        {picks.length ? (
          picks.map((item, index) => (
            <div className="tonight-pick" key={item.id}>
              <span className="pick-number">0{index + 1}</span>
              <PosterCard
                item={item}
                userState={state.userMedia[item.id]}
                priority={index === 0}
                reason={recommendationReason(item, state.userMedia[item.id])}
                onAdd={() => dispatch({ type: "add", mediaId: item.id })}
                onTrack={() =>
                  dispatch({ type: "mark-next", mediaId: item.id })
                }
              />
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h3>No honest matches yet.</h3>
            <p>Relax one filter and the shortlist will rebuild.</p>
          </div>
        )}
      </section>

      <section className="home-lower-grid">
        <div className="week-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ON YOUR RADAR</p>
              <h2>Happening this week</h2>
            </div>
            <Link to="/library">
              Open calendar <ArrowRight size={15} />
            </Link>
          </div>
          <div className="event-list">
            <article>
              <time>
                <strong>17</strong>
                <span>FRI</span>
              </time>
              <div className="event-art">
                <img src={hero.poster} alt="" />
              </div>
              <div>
                <span className="event-type">NEW EPISODE</span>
                <h3>Severance</h3>
                <p>“Woe’s Hollow” · Apple TV+</p>
              </div>
              <button type="button" aria-label="Set reminder for Severance">
                <CalendarDays size={18} />
              </button>
            </article>
            <article>
              <time>
                <strong>19</strong>
                <span>SUN</span>
              </time>
              <div className="event-art">
                <img
                  src={catalog.find((item) => item.id === "past-lives")?.poster}
                  alt=""
                />
              </div>
              <div>
                <span className="event-type available">NOW AVAILABLE</span>
                <h3>Past Lives</h3>
                <p>Saved 3 months ago · MUBI</p>
              </div>
              <span className="quiet-badge">Up Next</span>
            </article>
            <article>
              <time>
                <strong>21</strong>
                <span>TUE</span>
              </time>
              <div className="event-art">
                <img
                  src={catalog.find((item) => item.id === "andor")?.poster}
                  alt=""
                />
              </div>
              <div>
                <span className="event-type party">WATCH TOGETHER</span>
                <h3>Friday film shortlist</h3>
                <p>Sara and Maya are ready to vote</p>
              </div>
              <Link to="/friends" aria-label="Open watch together room">
                <Users size={18} />
              </Link>
            </article>
          </div>
        </div>

        <aside className="activity-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CLOSE FRIENDS</p>
              <h2>Worth knowing</h2>
            </div>
          </div>
          <div className="activity-item">
            <span className="friend-avatar warm">SA</span>
            <p>
              <strong>Sara</strong> strongly recommends{" "}
              <Link to="/title/portrait">Portrait of a Lady on Fire</Link>
              <small>“The final scene alone.” · spoiler-free</small>
            </p>
          </div>
          <div className="activity-item">
            <span className="friend-avatar blue">MY</span>
            <p>
              <strong>Maya</strong> finished the Severance episode you’re on
              <small>Her reaction unlocks when you finish</small>
            </p>
            <span className="lock-dot" aria-label="Spoiler hidden">
              ●
            </span>
          </div>
          <div className="activity-item">
            <span className="friend-avatar green">JO</span>
            <p>
              <strong>Jonas</strong> added Perfect Days from your shelf
              <small>12 minutes ago</small>
            </p>
          </div>
          <Link className="text-link" to="/friends">
            See friend space <ArrowRight size={15} />
          </Link>
        </aside>
      </section>

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
