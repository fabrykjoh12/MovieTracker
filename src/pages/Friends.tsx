import {
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../store";

export function Friends() {
  const { state, dispatch, catalog } = useStore();
  const room = state.room;
  return (
    <div className="page friends-page">
      <header className="page-title-row">
        <div>
          <p className="eyebrow">PEOPLE, WITHOUT THE NOISE</p>
          <h1>Friends</h1>
          <p>Recommendations, shared progress and plans that matter to you.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled
          title="Invites are coming soon"
        >
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
          <div className="participant-stack" aria-label="1 participant">
            <span title="You">AK</span>
          </div>
        </header>
        <div className="room-constraints">
          <span>Movie</span>
          <span>≤ {room.constraints.maxRuntime} min</span>
          <span>{room.constraints.mood}</span>
          <span>{room.constraints.services.join(" + ")}</span>
          <button type="button" disabled title="Coming soon">
            Edit constraints
          </button>
        </div>
        <div className="candidate-list">
          {room.candidates.map((candidate, index) => {
            const item = catalog.find(
              (entry) => entry.id === candidate.mediaId,
            );
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
          <span>Watch Together matching isn&rsquo;t live yet.</span>
          <button
            className="primary-button"
            type="button"
            disabled
            title="Revealing matches is coming soon"
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
          <div className="empty-state">
            <h3>No friends yet</h3>
            <p>
              Invite a friend to see their recommendations and reactions here.
              Activity is never shown until you actually have friends on the
              account.
            </p>
          </div>
        </div>
        <aside className="compatibility-card compatibility-card-empty">
          <p className="eyebrow">TASTE COMPATIBILITY</p>
          <h2>Coming soon</h2>
          <p>
            Compatibility scores need a real friend to compare against.
            They&rsquo;ll appear here once invites are live.
          </p>
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
