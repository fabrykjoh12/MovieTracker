import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Poster } from "./Poster";

interface MediaCardProps {
  title: string;
  meta?: string;
  reason?: string;
  poster?: string;
  pill?: string;
  to?: string;
  footer?: ReactNode;
}

export function MediaCard({
  title,
  meta,
  reason,
  poster,
  pill,
  to,
  footer,
}: MediaCardProps) {
  const posterEl = <Poster src={poster} alt={`${title} poster`} pill={pill} />;
  return (
    <article className="media-card">
      {to ? (
        <Link
          className="media-card-poster"
          to={to}
          tabIndex={-1}
          aria-hidden="true"
        >
          {posterEl}
        </Link>
      ) : (
        <div className="media-card-poster">{posterEl}</div>
      )}
      <div className="media-card-body">
        <h3 className="media-card-title">
          {to ? <Link to={to}>{title}</Link> : title}
        </h3>
        {meta && <p className="media-card-meta">{meta}</p>}
        {reason && <p className="media-card-reason">{reason}</p>}
      </div>
      {footer && <div className="media-card-footer">{footer}</div>}
    </article>
  );
}
