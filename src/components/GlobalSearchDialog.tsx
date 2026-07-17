import { useEffect, useRef } from "react";
import {
  AlertCircle,
  Check,
  Film,
  LoaderCircle,
  Plus,
  Search,
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
        <div>
          <p className="eyebrow">THE WHOLE CATALOG</p>
          <h2 id="global-search-title">Find a movie or series</h2>
        </div>
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
          <label className="global-search-input">
            <Search size={21} aria-hidden="true" />
            <span className="sr-only">Search movies and series globally</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try ‘The Bear’ or ‘Perfect Days’"
              autoComplete="off"
            />
            {searchState === "searching" && (
              <LoaderCircle className="spin" size={19} aria-hidden="true" />
            )}
          </label>

          <div className="global-search-tools">
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
            <span>Press Esc to close</span>
          </div>

          <p
            className={`global-search-status ${searchState}`}
            role="status"
            aria-live="polite"
          >
            {searchMessage || "Type at least two characters to search."}
          </p>

          <div className="global-search-results">
            {results.map((result) => {
              const localId = catalogResultLocalId(result);
              const saved = Boolean(state.userMedia[localId]);
              const imported = catalog.some((item) => item.id === localId);
              const busy = busyKey === catalogResultKey(result);
              return (
                <article key={catalogResultKey(result)}>
                  {result.poster ? (
                    <img
                      src={result.poster}
                      alt=""
                      width="128"
                      height="192"
                      loading="lazy"
                    />
                  ) : (
                    <div className="global-search-art" aria-hidden="true">
                      {result.format === "movie" ? (
                        <Film size={25} />
                      ) : (
                        <Tv size={25} />
                      )}
                    </div>
                  )}
                  <div className="global-search-result-copy">
                    <p>
                      {result.format} · {result.year ?? "Date pending"}
                    </p>
                    <h3>{result.title}</h3>
                    {result.originalTitle && (
                      <small>{result.originalTitle}</small>
                    )}
                    <span>{result.synopsis}</span>
                  </div>
                  <div className="global-search-result-actions">
                    {imported && (
                      <button
                        type="button"
                        className="search-result-secondary"
                        onClick={() => openTitle(localId)}
                      >
                        View
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
                        <LoaderCircle className="spin" size={16} />
                      ) : saved ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                      {busy ? "Adding" : saved ? "Saved" : "Add"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
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
