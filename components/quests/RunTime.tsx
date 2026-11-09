import { runTimeParts } from "@/lib/quests/format";

// A run time the way speedrun.com sets one: the digits at full size, each unit
// letter a step smaller in the same colour, so it reads as a stopwatch. Profa
// has no tabular figures, so each digit sits in a cell of one width (DIGIT_CELL)
// and a ticking clock never shifts the words beside it.
const DIGIT_CELL = "inline-block w-[0.64em] text-center";

export function RunTime({ ms, className = "" }: { ms: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {runTimeParts(ms).map((part, i) => (
        <span key={part.unit}>
          {i > 0 ? " " : ""}
          {Array.from(part.value).map((digit, d) => (
            <span key={d} className={DIGIT_CELL}>
              {digit}
            </span>
          ))}
          <span className="text-[0.8em]">{part.unit}</span>
        </span>
      ))}
    </span>
  );
}
