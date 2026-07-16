import { ChevronDown, Clock3, SlidersHorizontal, Users } from "lucide-react";
import { useStore } from "../store";
import type { MediaFormat, TonightFilters } from "../types";

const updateValue = <K extends keyof TonightFilters>(
  key: K,
  value: TonightFilters[K],
  dispatch: ReturnType<typeof useStore>["dispatch"],
) => dispatch({ type: "filters", filters: { [key]: value } });

export function TonightControls() {
  const { state, dispatch } = useStore();
  const { filters } = state;
  return (
    <details className="tonight-controls">
      <summary>
        <span>
          <SlidersHorizontal size={17} />
          Tune tonight
        </span>
        <div className="active-filters">
          <i>
            <Clock3 size={14} />
            {filters.maxRuntime} min
          </i>
          <i>{filters.format === "any" ? "Movie or series" : filters.format}</i>
          <i>
            <Users size={14} />
            {filters.company}
          </i>
        </div>
        <ChevronDown size={17} className="chevron" />
      </summary>
      <div className="filter-grid">
        <fieldset>
          <legend>Available time</legend>
          <div className="segmented">
            {[45, 90, 120, 180].map((time) => (
              <button
                type="button"
                key={time}
                className={filters.maxRuntime === time ? "selected" : ""}
                onClick={() => updateValue("maxRuntime", time, dispatch)}
              >
                {time === 180 ? "Any" : `${time}m`}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Format</legend>
          <div className="segmented">
            {(["any", "movie", "series"] as const).map((format) => (
              <button
                type="button"
                key={format}
                className={filters.format === format ? "selected" : ""}
                onClick={() =>
                  updateValue("format", format as "any" | MediaFormat, dispatch)
                }
              >
                {format === "any" ? "Either" : format}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Mood</legend>
          <select
            value={filters.mood}
            onChange={(event) =>
              updateValue("mood", event.target.value, dispatch)
            }
          >
            <option>Any mood</option>
            <option>Reflective</option>
            <option>Dark</option>
            <option>Comforting</option>
            <option>Strange</option>
            <option>Tense</option>
          </select>
        </fieldset>
        <fieldset>
          <legend>Watching</legend>
          <div className="segmented">
            {(["alone", "together"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={filters.company === value ? "selected" : ""}
                onClick={() => updateValue("company", value, dispatch)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Familiarity</legend>
          <div className="segmented">
            {(["familiar", "adventurous"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={filters.familiarity === value ? "selected" : ""}
                onClick={() => updateValue("familiarity", value, dispatch)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Emotional weight</legend>
          <div className="segmented">
            {(["light", "balanced", "demanding"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={filters.intensity === value ? "selected" : ""}
                onClick={() => updateValue("intensity", value, dispatch)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}
