import { ArrowRight, Check } from "lucide-react";
import { EggReveal } from "@/components/quests/EggReveal";
import { RunTime } from "@/components/quests/RunTime";
import { TrailingIcon } from "@/components/quests/TrailingIcon";
import { questCopy } from "@/lib/content/quests";
import type { GroupProgress, QuestGroup } from "@/lib/quests/types";

// One row per thing to find, like a speedrun's splits: a done row carries the
// run time it finished at; an open one says how many are left and offers the
// way there (an arrow line that closes the run and takes the visitor to it, or
// for the easter eggs a reveal). Once a row is done its way there goes away.

export type QuestTarget = Exclude<QuestGroup, "eggs">;

type Props = {
  groups: readonly GroupProgress[];
  found: Readonly<Record<string, number>>;
  touch: boolean;
  onGo: (target: QuestTarget) => void;
};

const GO_CLASS =
  "group/go mt-0.5 justify-self-start rounded-sm text-left text-sm text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Splits({ groups, found, touch, onGo }: Props) {
  const { groups: names, left, done } = questCopy.panel;
  const { count } = questCopy.button;
  return (
    <ol className="flex flex-col">
      {groups.map((g) => {
        const copy: { label: string; go?: string; touch?: string } = names[g.group];
        const goText = touch && copy.touch ? copy.touch : copy.go;
        return (
          <li key={g.group} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 border-t border-border py-3 first:border-t-0">
            <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full ${g.done ? "bg-accent text-background" : "[box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--color-muted)_55%,transparent)]"}`}>
              {g.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0 font-label text-label-lg text-foreground">
              {copy.label}
              <span className="ml-2 tabular-nums text-muted">{count(Math.min(g.found, g.needed), g.needed)}</span>
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
            {!g.done && g.group === "eggs" && (
              <div className="col-span-2 col-start-2 mt-0.5 min-w-0">
                <EggReveal found={found} touch={touch} />
              </div>
            )}
            {!g.done && g.group !== "eggs" && goText && (
              <button type="button" onClick={() => onGo(g.group as QuestTarget)} className={`${GO_CLASS} col-span-2 col-start-2`}>
                <TrailingIcon text={goText} icon={<ArrowRight aria-hidden="true" size={14} strokeWidth={2.25} className="ml-1.5 inline-block align-[-2px] transition-transform duration-200 group-hover/go:translate-x-0.5 motion-reduce:transition-none" />} />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
