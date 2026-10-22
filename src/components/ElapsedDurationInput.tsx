import type { DurationSeconds } from "../domain/training";
import {
  durationSegments,
  segmentName,
  splitDuration,
} from "./elapsedDuration";

type ElapsedDurationInputProps = {
  readonly legend: string;
  readonly name: string;
  readonly defaultValue?: DurationSeconds;
};

export default function ElapsedDurationInput({
  legend,
  name,
  defaultValue,
}: ElapsedDurationInputProps) {
  const defaultSegments =
    defaultValue === undefined ? undefined : splitDuration(defaultValue);

  return (
    <fieldset className="elapsed-duration-input">
      <legend>{legend}</legend>
      <div className="elapsed-duration-segments">
        {durationSegments.map((segment) => (
          <label key={segment}>
            <span>{segment[0]?.toUpperCase() + segment.slice(1)}</span>
            <input
              aria-label={`${legend} ${segment}`}
              name={segmentName(name, segment)}
              type="number"
              inputMode="numeric"
              min="0"
              max={segment === "hours" ? undefined : "59"}
              step="1"
              placeholder="0"
              defaultValue={defaultSegments?.[segment]}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
