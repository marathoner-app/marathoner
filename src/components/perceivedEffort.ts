import type { PerceivedEffort } from "../domain/training";

export const perceivedEffortOptions = [
  { value: "much_easier_than_expected", label: "Much easier than expected" },
  { value: "easier_than_expected", label: "Easier than expected" },
  { value: "about_right", label: "About as expected" },
  { value: "harder_than_expected", label: "Harder than expected" },
  { value: "much_harder_than_expected", label: "Much harder than expected" },
] as const satisfies readonly {
  readonly value: PerceivedEffort;
  readonly label: string;
}[];

export function formatPerceivedEffort(
  value: PerceivedEffort | undefined,
): string {
  if (value === undefined) return "Not recorded";

  return (
    perceivedEffortOptions.find((option) => option.value === value)?.label ??
    "Not recorded"
  );
}
