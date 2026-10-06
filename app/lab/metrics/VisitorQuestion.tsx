"use client";

import { useEffect, useState } from "react";

// A mock only: no backend, no storage, invented shares. It exists so Aaron
// can judge whether asking the visitor something belongs on the page at all.
// The copy is placeholder.

const ANSWERS = [
  { id: "recruiter", label: "A recruiter link", share: 46 },
  { id: "friend", label: "A friend sent it", share: 31 },
  { id: "curious", label: "Just curious", share: 23 },
] as const;

export function VisitorQuestion() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <section aria-label="A question for the visitor (mock)" className="relative w-full border-t border-border px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <div className="m-label flex items-center gap-3 text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>Mock, nothing is stored</span>
          </div>
          <h2 className="m-placeholder mt-6 font-display text-2xl md:text-3xl">What brought you here?</h2>
        </div>

        <div className="md:col-span-7">
          {picked === null ? (
            <div className="flex flex-wrap gap-2">
              {ANSWERS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPicked(a.id)}
                  className="m-label rounded-full px-4 py-2.5 text-accent shadow-[inset_0_0_0_1px_var(--color-border)] transition-[color,box-shadow] duration-200 hover:text-accent-hover hover:shadow-[inset_0_0_0_1px_var(--color-accent)]"
                >
                  <span className="m-placeholder">{a.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <Results picked={picked} onReset={() => setPicked(null)} />
          )}
        </div>
      </div>
    </section>
  );
}

function Results({ picked, onReset }: { picked: string; onReset: () => void }) {
  const [grown, setGrown] = useState(false);
  // One frame at zero width, then the bars grow to their shares.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {ANSWERS.map((a, i) => {
          const mine = a.id === picked;
          return (
            <li key={a.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className={"m-label " + (mine ? "text-accent" : "text-muted")}>
                  {a.label}
                  {mine && <span className="text-muted">, your answer</span>}
                </span>
                <span className="font-display text-xl tabular-nums text-foreground">{a.share}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                  style={{
                    width: grown ? a.share + "%" : "0%",
                    background: mine ? "var(--color-accent)" : "var(--color-muted)",
                    transitionDelay: i * 80 + "ms",
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between gap-4">
        <span className="m-label-sm text-muted">Placeholder shares, invented for the mock.</span>
        <button type="button" onClick={onReset} className="m-label-sm text-accent hover:text-accent-hover">
          Ask again
        </button>
      </div>
    </div>
  );
}
