"use client";

import { useCallback, useRef } from "react";
import { AsMark } from "@/components/menu/BrandMark";
import { usePlayer } from "./player";
import type { Settings } from "./settings";
import { buildStrike } from "./strike";
import { CelStage, StrikeMark } from "./StrikeMark";
import { Caption } from "./ui";

const SIZES = [96, 48] as const;

function LoopCell({ s, size, speed, label }: { s: Settings; size: number; speed: number; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const build = useCallback(
    (scope: Element) =>
      buildStrike(scope, s, { night: scope.querySelector("[data-cel-night]"), celFlash: scope.querySelector("[data-cel-flash]") }).timeScale(speed),
    [s, speed],
  );
  usePlayer(ref, build, { loop: true });
  return (
    <figure className="flex flex-col">
      <div ref={ref} className="relative isolate flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
        <CelStage s={s} where={`small-${size}-${speed}`} />
        <StrikeMark s={s} sizePx={size} />
      </div>
      <Caption>{label}</Caption>
    </figure>
  );
}

export function SmallSizes({ s, reduced }: { s: Settings; reduced: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-wrap gap-6">
          <figure className="flex flex-col">
            <div className="flex h-[150px] w-[150px] items-center justify-center rounded-xl text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)]">
              <div style={{ width: size, height: size }}>
                <AsMark className="block h-full w-full" />
              </div>
            </div>
            <Caption>{size}px settled (the real AsMark)</Caption>
          </figure>
          {!reduced && <LoopCell s={s} size={size} speed={s.speed} label={`${size}px at speed`} />}
          {!reduced && <LoopCell s={s} size={size} speed={s.speed * 0.35} label={`${size}px slowed to 0.35x`} />}
        </div>
      ))}
    </div>
  );
}
