import { useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookmarkPlus,
  Check,
  Clapperboard,
  Film,
  LoaderCircle,
  Search,
  SearchX,
  Tv,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  catalogResultKey,
  catalogResultLocalId,
  useCatalogSearch,
} from "../hooks/useCatalogSearch";
import { useStore } from "../store";

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

const searchStarters = ["The Bear", "Perfect Days", "Severance"];

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { state, catalog } = useStore();
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const openTitle = (localId: string) => {
    onClose();
    navigate(`/title/${localId}`);
  };

  return (
    <dialog
      ref={dialogRef}
      id="global-search-dialog"
      className="global-search-dialog"
      aria-labelledby="global-search-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="global-search-header">
        <p className="eyebrow">
          <span aria-hidden="true" />
          THE WHOLE CATALOG
        </p>
        <h2 id="global-search-title">Search the archive</h2>
        <p>Real films and series, ready for your library.</p>
        <button
          className="dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close search"
        >
          <X size={20} />
        </button>
      </header>

      {configured ? (
        <>
          <div className="global-search-query">
            <label className="global-search-input">
              <Search size={22} aria-hidden="true" />
              <span className="sr-only">Search movies and series globally</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title"
                autoComplete="off"
              />
              {searchState === "searching" ? (
                <LoaderCircle className="spin" size={19} aria-hidden="true" />
              ) : (
                <kbd aria-hidden="true">ESC</kbd>
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
                      ? "Films"
                      : "Series"}
                </button>
              ))}
            </div>
          </div>

          <section className="global-search-stage" aria-label="Search results">
            {searchState === "idle" && (
              <div className="global-search-start">
                <div className="global-search-start-mark" aria-hidden="true">
                  <Clapperboard size={28} />
                  <span>01</span>
                </div>
                <div>
                  <p className="eyebrow">
                    {query.trim().length === 1
                      ? "KEEP TYPING"
                      : "START WITH A TITLE"}
                  </p>
                  <h3>
                    {query.trim().length === 1
                      ? "One more character."
                      : "Find the exact story you mean."}
                  </h3>
                  <p>
                    Search across films and series, then save a complete title
                    with artwork, runtime and season information.
                  </p>
                  {query.trim().length === 0 && (
                    <div className="global-search-suggestions">
                      <span>Try</span>
                      {searchStarters.map((starter) => (
                        <button
                          key={starter}
                          type="button"
                          onClick={() => setQuery(starter)}
                        >
                          {starter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {searchState === "searching" && (
              <div className="global-search-loading" role="status">
                <span className="sr-only">Searching the catalog</span>
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} aria-hidden="true">
                    <i />
                    <span>
                      <b />
                      <b />
                      <b />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {searchState === "ready" && results.length === 0 && (
              <div className="global-search-empty" role="status">
                <SearchX size={28} />
                <div>
                  <h3>No matching titles</h3>
                  <p>
                    {searchMessage} Try another spelling or a broader format.
                  </p>
                </div>
              </div>
            )}

            {searchState === "error" && results.length === 0 && (
              <div className="global-search-empty is-error" role="alert">
                <AlertCircle size={28} />
                <div>
                  <h3>Search could not connect</h3>
                  <p>{searchMessage}</p>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className={`global-search-meta ${searchState}`}>
                  <p role="status" aria-live="polite">
                    {searchMessage}
                  </p>
                  <span>Metadata and artwork by TMDB</span>
                </div>
                <div className="global-search-results">
                  {results.map((result) => {
                    const localId = catalogResultLocalId(result);
                    const saved = Boolean(state.userMedia[localId]);
                    const imported = catalog.some(
                      (item) => item.id === localId,
                    );
                    const busy = busyKey === catalogResultKey(result);
                    return (
                      <article
                        key={catalogResultKey(result)}
                        className={saved ? "is-saved" : ""}
                      >
                        <div className="global-search-poster">
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
                              className="global-search-art"
                              aria-hidden="true"
                            >
                              {result.format === "movie" ? (
                                <Film size={25} />
                              ) : (
                                <Tv size={25} />
                              )}
                            </div>
                          )}
                          <span>
                            {result.format === "movie" ? "Film" : "Series"}
                          </span>
                        </div>
                        <div className="global-search-result-copy">
                          <p>{result.year ?? "Release date pending"}</p>
                          <h3>{result.title}</h3>
                          {result.originalTitle && (
                            <small>{result.originalTitle}</small>
                          )}
                          <span>{result.synopsis}</span>
                          <div className="global-search-result-actions">
                            {imported && (
                              <button
                                type="button"
                                className="search-result-secondary"
                                onClick={() => openTitle(localId)}
                                aria-label={`View ${result.title}`}
                              >
                                View <ArrowUpRight size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="search-result-primary"
                              disabled={saved || busy || busyKey !== undefined}
                              onClick={() => void addToLibrary(result)}
                              aria-label={
                                saved
                                  ? `${result.title} is in your library`
                                  : `Add ${result.title} to library`
                              }
                            >
                              {busy ? (
                                <LoaderCircle className="spin" size={15} />
                              ) : saved ? (
                                <Check size={15} />
                              ) : (
                                <BookmarkPlus size={15} />
                              )}
                              {busy ? "Saving" : saved ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <footer className="global-search-footer">
            <span>Search by title · Filter by format · Save in one step</span>
            <span>Press ESC to close</span>
          </footer>
        </>
      ) : (
        <div className="global-search-unavailable" role="status">
          <AlertCircle size={20} />
          <div>
            <strong>Catalog search is not connected.</strong>
            <span>The curated library remains available in demo mode.</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
