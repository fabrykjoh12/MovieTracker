import { BookmarkPlus, Check, MoreHorizontal, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { formatVerdict, progressPercent, statusLabel } from "../domain";
import type { Media, UserMediaState } from "../types";

interface PosterCardProps {
  item: Media;
  userState?: UserMediaState;
  reason?: string;
  priority?: boolean;
  onAdd?: () => void;
  onTrack?: () => void;
}

export function PosterCard({
  item,
  userState,
  reason,
  priority,
  onAdd,
  onTrack,
}: PosterCardProps) {
  const progress = progressPercent(item, userState?.progress);
  return (
    <article className="poster-card">
      <div className="poster-frame">
        <Link to={`/title/${item.id}`} aria-label={`View ${item.title}`}>
          <img
            src={item.poster}
            alt={`${item.title} editorial artwork`}
            loading="lazy"
            width="480"
            height="720"
          />
        </Link>
        <div className="poster-topline">
          {priority && <span className="priority-badge">Up next</span>}
          {userState?.verdict && (
            <span className="verdict-badge">
              {formatVerdict(userState.verdict.kind)}
            </span>
          )}
        </div>
        <div className="poster-actions">
          {userState ? (
            <button
              type="button"
              onClick={onTrack}
              aria-label={`Track ${item.title}`}
            >
              <Play size={16} fill="currentColor" />
              {item.format === "series"
                ? "Next episode"
                : userState.status === "completed"
                  ? "Watched"
                  : "Log watched"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Add ${item.title} to library`}
            >
              <BookmarkPlus size={16} />
              Add to library
            </button>
          )}
          <Link
            to={`/title/${item.id}`}
            aria-label={`More options for ${item.title}`}
          >
            <MoreHorizontal size={18} />
          </Link>
        </div>
        {progress > 0 && progress < 100 && (
          <div
            className="poster-progress"
            role="progressbar"
            aria-label={`${progress}% watched`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${progress}%`, background: item.accent }} />
          </div>
        )}
      </div>
      <div className="poster-copy">
        <div>
          <h3>
            <Link to={`/title/${item.id}`}>{item.title}</Link>
          </h3>
          <p>
            {item.year} ·{" "}
            {item.format === "movie"
              ? `${item.runtime} min`
              : `${item.seasons?.length ?? 0} seasons`}
          </p>
        </div>
        {userState?.status === "completed" ? (
          <Check size={16} aria-label="Completed" />
        ) : (
          userState && (
            <span className="state-dot">{statusLabel(userState.status)}</span>
          )
        )}
      </div>
      {reason && <p className="card-reason">{reason}</p>}
    </article>
  );
}
