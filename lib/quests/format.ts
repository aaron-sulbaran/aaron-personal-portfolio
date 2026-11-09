// Speedrun-style run time: 42s as "0m 42s", an hour and more as "1h 02m 05s".
export interface RunTimePart {
  value: string;
  unit: "h" | "m" | "s";
}

export function runTimeParts(ms: number): RunTimePart[] {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return [{ value: String(hours), unit: "h" }, { value: pad(minutes), unit: "m" }, { value: pad(seconds), unit: "s" }];
  return [{ value: String(minutes), unit: "m" }, { value: pad(seconds), unit: "s" }];
}

export function formatRunTime(ms: number): string {
  return runTimeParts(ms).map((part) => `${part.value}${part.unit}`).join(" ");
}
