import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { formatVerdict } from "../domain";
import type { Quality, VerdictKind } from "../types";

const verdicts: { kind: VerdictKind; symbol: string; helper: string }[] = [
  { kind: "all-timer", symbol: "✦", helper: "Stays with me" },
  { kind: "loved", symbol: "♥", helper: "A clear favourite" },
  { kind: "liked", symbol: "●", helper: "Glad I watched" },
  { kind: "mixed", symbol: "◐", helper: "Some good, some not" },
  { kind: "not-for-me", symbol: "–", helper: "Not bad—just not mine" },
  { kind: "dropped", symbol: "×", helper: "Didn’t finish" },
];

const qualities: Quality[] = [
  "Story",
  "Characters",
  "Performances",
  "Visuals",
  "Atmosphere",
  "Soundtrack",
  "Emotion",
  "Originality",
  "Ending",
  "Rewatchability",
];
const tags = [
  "Slow burn",
  "Worth the hype",
  "Great concept",
  "Comfort watch",
  "Devastating",
  "Strong ending",
  "Great chemistry",
  "Unforgettable performance",
];

interface VerdictModalProps {
  open: boolean;
  title: string;
  initial?: VerdictKind;
  onClose: () => void;
  onSave: (
    kind: VerdictKind,
    qualities: Quality[],
    tags: string[],
    rank?: number,
  ) => void;
}

export function VerdictModal({
  open,
  title,
  initial,
  onClose,
  onSave,
}: VerdictModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<VerdictKind | undefined>(initial);
  const [selectedQualities, setSelectedQualities] = useState<Quality[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compared, setCompared] = useState<"new" | "dune" | undefined>();

  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    if (!open && node?.open) node.close();
  }, [open]);

  const toggleQuality = (quality: Quality) =>
    setSelectedQualities((current) =>
      current.includes(quality)
        ? current.filter((item) => item !== quality)
        : current.length < 3
          ? [...current, quality]
          : current,
    );
  const toggleTag = (tag: string) =>
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  const submit = () => {
    if (!kind) return;
    const rank =
      kind === "all-timer" || kind === "loved"
        ? compared === "new"
          ? 2
          : 6
        : undefined;
    onSave(kind, selectedQualities, selectedTags, rank);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="verdict-dialog"
      onCancel={onClose}
      onClose={() => {
        if (open) onClose();
      }}
      aria-labelledby="verdict-title"
    >
      <button
        className="dialog-close"
        type="button"
        onClick={onClose}
        aria-label="Close verdict"
      >
        <X size={20} />
      </button>
      <p className="eyebrow">YOUR VERDICT</p>
      <h2 id="verdict-title">
        How did <em>{title}</em> feel?
      </h2>
      <p className="dialog-intro">
        A human reaction first. Details are optional.
      </p>
      <div className="verdict-grid">
        {verdicts.map((item) => (
          <button
            className={kind === item.kind ? "selected" : ""}
            type="button"
            key={item.kind}
            onClick={() => setKind(item.kind)}
          >
            <span>{item.symbol}</span>
            <strong>{formatVerdict(item.kind)}</strong>
            <small>{item.helper}</small>
          </button>
        ))}
      </div>
      <section className="verdict-section">
        <div className="section-label">
          <span>What stood out?</span>
          <small>Choose up to three</small>
        </div>
        <div className="choice-chips">
          {qualities.map((quality) => (
            <button
              type="button"
              key={quality}
              className={selectedQualities.includes(quality) ? "selected" : ""}
              onClick={() => toggleQuality(quality)}
            >
              {selectedQualities.includes(quality) && <Check size={14} />}
              {quality}
            </button>
          ))}
        </div>
      </section>
      <section className="verdict-section compact">
        <div className="section-label">
          <span>Quick tags</span>
          <small>Optional</small>
        </div>
        <div className="choice-chips subtle">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={selectedTags.includes(tag) ? "selected" : ""}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>
      {(kind === "all-timer" || kind === "loved") && (
        <section className="pairwise-box">
          <div>
            <p className="eyebrow">PERSONAL RANKING</p>
            <h3>Which did you prefer?</h3>
            <span>One comparison places it among your favourites.</span>
          </div>
          <div className="pairwise-options">
            <button
              type="button"
              className={compared === "new" ? "selected" : ""}
              onClick={() => setCompared("new")}
            >
              {title}
            </button>
            <span>or</span>
            <button
              type="button"
              className={compared === "dune" ? "selected" : ""}
              onClick={() => setCompared("dune")}
            >
              Dune: Part Two
            </button>
          </div>
        </section>
      )}
      <footer className="dialog-footer">
        <span>
          {kind
            ? `${formatVerdict(kind)} selected`
            : "Choose a verdict to continue"}
        </span>
        <button
          className="primary-button"
          type="button"
          disabled={!kind}
          onClick={submit}
        >
          Save verdict
        </button>
      </footer>
    </dialog>
  );
}
