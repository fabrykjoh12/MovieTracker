import {
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { media } from "../data";
import { mutualMatches } from "../domain";
import { useStore } from "../store";

export function Friends() {
  const { state, dispatch } = useStore();
  const room = state.room;
  const matches = mutualMatches(room);
  return (
    <div className="page friends-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">PEOPLE, WITHOUT THE NOISE</p>
          <h1>Friends</h1>
          <p>Recommendations, shared progress and plans that matter to you.</p>
        </div>
        <button className="secondary-button" type="button">
          <Plus size={18} />
          Invite a friend
        </button>
      </header>
      <section className="watch-room">
        <header>
          <div>
            <p className="eyebrow">
              <span className="live-dot" /> WATCH TOGETHER ROOM
            </p>
            <h2>{room.name}</h2>
            <p>Private voting. Nobody has to defend a no.</p>
          </div>
          <div
            className="participant-stack"
            aria-label={`${room.participants.length} participants`}
          >
            {room.participants.map((person) => (
              <span key={person} title={person}>
                {person === "You" ? "AK" : person.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        </header>
        <div className="room-constraints">
          <span>Movie</span>
          <span>≤ {room.constraints.maxRuntime} min</span>
          <span>{room.constraints.mood}</span>
          <span>{room.constraints.services.join(" + ")}</span>
          <button type="button">Edit constraints</button>
        </div>
        <div className="candidate-list">
          {room.candidates.map((candidate, index) => {
            const item = media.find((entry) => entry.id === candidate.mediaId);
            const myVote = candidate.votes.You;
            if (!item) return null;
            return (
              <article
                key={candidate.mediaId}
                className={myVote ? "voted" : ""}
              >
                <span className="candidate-number">0{index + 1}</span>
                <img src={item.poster} alt="" />
                <div className="candidate-copy">
                  <h3>
                    <Link to={`/title/${item.id}`}>{item.title}</Link>
                  </h3>
                  <p>
                    {item.year} · {item.runtime} min · {item.services[0]}
                  </p>
                  <small>{candidate.reason}</small>
                </div>
                <div
                  className="private-vote"
                  aria-label={`Your vote for ${item.title}`}
                >
                  <span>
                    Your vote <LockKeyhole size={12} />
                  </span>
                  <div>
                    {(["yes", "maybe", "no"] as const).map((vote) => (
                      <button
                        type="button"
                        key={vote}
                        className={myVote === vote ? "selected" : ""}
                        onClick={() =>
                          dispatch({ type: "vote", mediaId: item.id, vote })
                        }
                      >
                        {myVote === vote && <Check size={13} />}
                        {vote}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <footer>
          <span>
            {matches.length
              ? `${matches.length} possible mutual ${matches.length === 1 ? "match" : "matches"}`
              : "Vote to reveal mutual matches"}
          </span>
          <button
            className="primary-button"
            type="button"
            disabled={room.candidates.some((candidate) => !candidate.votes.You)}
          >
            Reveal matches <ChevronRight size={17} />
          </button>
        </footer>
      </section>
      <section className="friends-grid">
        <div className="friend-events">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RECENT & RELEVANT</p>
              <h2>Friend activity</h2>
            </div>
          </div>
          <article>
            <span className="friend-avatar warm">SA</span>
            <div>
              <p>
                <strong>Sara</strong> gave{" "}
                <Link to="/title/portrait">Portrait of a Lady on Fire</Link> an
                All-timer verdict.
              </p>
              <small>Visuals · Emotion · Ending</small>
              <blockquote>
                “Every look feels like a whole conversation.”
              </blockquote>
              <span>18 minutes ago</span>
            </div>
          </article>
          <article>
            <span className="friend-avatar blue">MY</span>
            <div>
              <p>
                <strong>Maya</strong> finished Severance S2 E8.
              </p>
              <small>
                <LockKeyhole size={13} />
                Reaction hidden until you reach this episode
              </small>
              <button className="spoiler-button" type="button">
                Reveal anyway
              </button>
              <span>Yesterday</span>
            </div>
          </article>
          <article>
            <span className="friend-avatar green">JO</span>
            <div>
              <p>
                <strong>Jonas</strong> wants to watch{" "}
                <Link to="/title/perfect-days">Perfect Days</Link> with you.
              </p>
              <small>Both of you saved it · 2h 4m</small>
              <span>Tuesday</span>
            </div>
          </article>
        </div>
        <aside className="compatibility-card">
          <div className="compat-orbit">
            <span>AK</span>
            <i />
            <span>SA</span>
          </div>
          <p className="eyebrow">TASTE COMPATIBILITY</p>
          <h2>You & Sara</h2>
          <strong>Closely aligned</strong>
          <p>
            You both favour patient, character-led stories. Sara leans darker;
            you’re more generous with quiet comedy.
          </p>
          <div>
            <span>
              <i style={{ width: "87%" }} />
              Pacing
            </span>
            <span>
              <i style={{ width: "76%" }} />
              Tone
            </span>
            <span>
              <i style={{ width: "92%" }} />
              Story
            </span>
          </div>
          <button type="button">
            Compare taste maps <ChevronRight size={16} />
          </button>
        </aside>
      </section>
      <section className="social-principle">
        <MessageCircle size={22} />
        <div>
          <h3>Spoilers follow progress, not trust.</h3>
          <p>
            Episode reactions are filtered before they reach your feed. You
            control every reveal.
          </p>
        </div>
        <Link to="/title/severance">See it in action</Link>
      </section>
    </div>
  );
}
