"use client";

import { useEffect, useRef, useState } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { StepControls } from "./StepControls";

const { loop } = hiveStoryCopy.calls;
const STEPS = loop.steps.length;
const STEP_MS = 2300;
const HOLD_MS = 3400;
// Without JS the demo rests on the tap (step 4, index 3); parts marked
// data-rest="off" belong to other steps and stay out of that still.
const REST = 3;

type Span = { in: number; out?: number; rest?: "off" };
const at = (s: Span) => ({ "data-in": s.in, "data-out": s.out, "data-rest": s.rest });

function Bars({ widths }: { widths: number[] }) {
  return <span className="hive-bars" aria-hidden="true">{widths.map((w, i) => <span key={i} style={{ width: `${w}%` }} />)}</span>;
}

function Reaction({ kind, count, span, me }: { kind: "pending" | "confirmed" | "corrected"; count: number; span: Span; me?: boolean }) {
  return (
    <span className={`hive-react ${me ? "hive-react-me" : ""}`} {...at(span)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 16px brand SVG, nothing for next/image to do */}
      <img src={`/hive-story/react-${kind}.svg`} alt="" width={16} height={16} />
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{loop.reacts[kind]}</span>
    </span>
  );
}

/** A teammate's AI saves a note with the Hive's own tool; Beekeeper asks the author; the author has the final say. */
export function HiveLoopDemo() {
  const ref = useRef<HTMLElement>(null);
  const api = useRef<{ goTo: (s: number) => void; setAuto: (on: boolean) => void } | null>(null);
  const [step, setStep] = useState(REST);
  const [auto, setAutoState] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const parts = Array.from(root.querySelectorAll<HTMLElement>("[data-in]"));
    let current = -1, timer = 0, onScreen = false, isAuto = !reduce.matches;

    const show = (s: number) => {
      current = s;
      setStep(s);
      root.dataset.step = String(s);
      for (const part of parts) {
        const from = Number(part.dataset.in), to = part.dataset.out ? Number(part.dataset.out) : Infinity;
        part.toggleAttribute("data-off", !(s >= from && s < to));
      }
    };
    const tick = () => {
      show(current >= STEPS - 1 ? 0 : current + 1);
      timer = window.setTimeout(tick, current === STEPS - 1 ? HOLD_MS : STEP_MS);
    };
    const pause = () => { window.clearTimeout(timer); timer = 0; };
    const update = () => {
      setReduced(reduce.matches);
      if (reduce.matches && isAuto) { isAuto = false; setAutoState(false); pause(); return; }
      const live = isAuto && onScreen && !document.hidden;
      if (live && !timer) tick();
      else if (!live && timer) pause();
    };
    api.current = {
      goTo: (s) => { isAuto = false; setAutoState(false); pause(); show(s); },
      setAuto: (on) => { if (reduce.matches) return; isAuto = on; setAutoState(on); if (on) update(); else pause(); },
    };
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }, { threshold: 0.3 });
    io.observe(root);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { pause(); io.disconnect(); reduce.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  const d = loop.discord;
  return (
    <figure ref={ref} className="hive-loop m-0">
      <div className="hive-loop-panes">
        <div className="hive-ai" {...at({ in: 0 })}>
          <p className="hive-pane-title">{loop.ai.title}</p>
          <p className="hive-ai-ask">{loop.ai.ask}</p>
          <div className="hive-ai-tool">
            <code>{loop.ai.tool}</code>
            <span className="hive-ai-arg">{loop.ai.args}</span>
          </div>
          <p className="hive-ai-result">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 16px brand SVG */}
            <img src="/hive-story/react-pending.svg" alt="" width={16} height={16} />
            {loop.ai.result}
          </p>
        </div>
        <div className="hive-discord" {...at({ in: 1 })}>
          <p className="hive-discord-channel"># {d.channel}</p>
          <div className="hive-discord-msg">
            {/* eslint-disable-next-line @next/next/no-img-element -- Beekeeper's avatar, a small SVG */}
            <img src="/hive-story/beekeeper.svg" alt="" width={40} height={40} className="hive-discord-avatar" />
            <div className="min-w-0">
              <p className="hive-discord-who"><b>{d.name}</b> <span className="hive-discord-app">{d.app}</span> <span className="hive-discord-time">{d.time}</span></p>
              <p className="hive-discord-text">{d.lead} <span className="hive-mention">@{d.author}</span>{d.tail}</p>
              <div className="hive-discord-fact">
                <span {...at({ in: 0, out: 4 })}><Bars widths={[92, 64]} /></span>
                <span {...at({ in: 4, rest: "off" })}><Bars widths={[88, 52]} /></span>
                <span className="hive-discord-meta">
                  <span className="hive-discord-source">{d.source}</span>
                  <span className="hive-badge" {...at({ in: 1, out: 3, rest: "off" })}>{d.badges.unconfirmed}</span>
                  <span className="hive-badge hive-badge-on" {...at({ in: 3, out: 4 })}>{d.badges.confirmed}</span>
                  <span className="hive-badge hive-badge-on" {...at({ in: 4, rest: "off" })}>{d.badges.corrected}</span>
                </span>
              </div>
              <p className="hive-discord-reacts" {...at({ in: 2 })}>
                <Reaction kind="pending" count={1} span={{ in: 2, out: 3, rest: "off" }} />
                <Reaction kind="confirmed" count={2} me span={{ in: 3, out: 4 }} />
                <Reaction kind="corrected" count={2} me span={{ in: 4, rest: "off" }} />
              </p>
            </div>
          </div>
          <div className="hive-discord-msg hive-discord-reply" {...at({ in: 4, rest: "off" })}>
            <span className="hive-discord-person" aria-hidden="true">{d.author[0]}</span>
            <div className="min-w-0">
              <p className="hive-discord-who"><b>{d.author}</b> <span className="hive-discord-time">{d.reply}</span></p>
              <Bars widths={[70]} />
            </div>
          </div>
        </div>
      </div>
      <p className="hive-loop-step" aria-hidden="true"><span className="tabular-nums">{step + 1}</span> {loop.steps[step]}</p>
      <div className="mt-3">
        <StepControls step={step} count={STEPS} playing={auto && !reduced} canPlay={!reduced} onBack={() => api.current?.goTo(Math.max(0, step - 1))} onNext={() => api.current?.goTo(Math.min(STEPS - 1, step + 1))} onToggle={() => api.current?.setAuto(!auto)} label={loop.label} />
      </div>
      <figcaption className="sr-only">{loop.description}</figcaption>
    </figure>
  );
}
