import { Check } from "lucide-react";
import { RunTime } from "@/components/quests/RunTime";
import { questCopy } from "@/lib/content/quests";
import type { GroupProgress } from "@/lib/quests/types";

// One row per thing to find, like a speedrun's splits: a done row carries the
// run time it finished at; an open one says how many are left. Rows lead with
// what is already found (a started list pulls harder than an empty one).
export function Splits({ groups }: { groups: readonly GroupProgress[] }) {
  const { groups: names, left, done } = questCopy.panel;
  const { count } = questCopy.button;
  return (
    <ol className="flex flex-col">
      {groups.map((g) => (
        <li key={g.group} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 border-t border-border py-3 first:border-t-0">
          <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full ${g.done ? "bg-accent text-background" : "[box-shadow:inset_0_0_0_1px_var(--color-border)]"}`}>
            {g.done && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-label text-label-lg text-foreground">
              {names[g.group].label}
              <span className="ml-2 tabular-nums text-muted">
                {count(Math.min(g.found, g.needed), g.needed)}
              </span>
            </span>
            {!g.done && <span className="text-sm text-muted">{names[g.group].hint}</span>}
          </span>
          <span className="pt-0.5 text-right font-label text-label tabular-nums">
            {g.done && g.doneAtMs !== null ? (
              <>
                <span className="sr-only">{done}, </span>
                <RunTime ms={g.doneAtMs} className="text-accent" />
              </>
            ) : (
              <span className="text-muted">{left(g.left)}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
