import { hiveStoryCopy } from "@/lib/content/hive-story";
import { NEXT_NODES, staticDots, type FlowLayout, type NodeKey } from "@/lib/hive-story/flow";

const { flow } = hiveStoryCopy;
const r2 = (n: number) => Math.round(n * 100) / 100;

// The Hive's flow at rest: every part, every trace, the comb, the open question
// and the author's check, in dots. Server-rendered, so the whole diagram is in
// the first paint with no JS; FlowSwarm's bees fly underneath it.
export function FlowSvg({ layout, className }: { layout: FlowLayout; className?: string }) {
  const dots = staticDots(layout);
  const s = layout.size;
  const wide = layout.name === "wide";
  const L = layout.labels;
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="var(--hive-bee)"
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      <g fillOpacity={0.5}>
        {dots.traces.filter((t) => !t.next).map((t, i) => <circle key={i} cx={r2(t.p.x)} cy={r2(t.p.y)} r={s.traceDot} />)}
      </g>
      <g fillOpacity={0.42}>
        {dots.traces.filter((t) => t.next).map((t, i) => <circle key={i} cx={r2(t.p.x)} cy={r2(t.p.y)} r={s.traceDot} />)}
      </g>
      <g>
        {dots.nodes.filter((n) => !n.next).map((n, i) => <circle key={i} cx={r2(n.p.x)} cy={r2(n.p.y)} r={s.nodeDot} />)}
      </g>
      <g fill="none" stroke="var(--hive-bee)" strokeWidth={wide ? 1 : 0.9} strokeOpacity={0.85}>
        {dots.nodes.filter((n) => n.next).map((n, i) => <circle key={i} cx={r2(n.p.x)} cy={r2(n.p.y)} r={s.nextDot} />)}
        {dots.check.map((p, i) => <circle key={`c${i}`} cx={r2(p.x)} cy={r2(p.y)} r={s.checkDot} />)}
      </g>
      <g>
        {dots.comb.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={s.combDot} />)}
        {dots.question.map((p, i) => <circle key={`q${i}`} cx={r2(p.x)} cy={r2(p.y)} r={s.glyphDot} />)}
      </g>
      {(Object.keys(layout.nodes) as NodeKey[]).map((key) => {
        const b = layout.nodes[key];
        const copy = flow.nodes[key];
        return (
          <g key={key} data-next={NEXT_NODES.has(key) || undefined}>
            <text x={b.x + s.nodePad} y={b.y + s.labelY} fontSize={s.label} fontWeight={650}>{copy.label}</text>
            <text x={b.x + s.nodePad} y={b.y + s.subY} fontSize={s.sub} fontWeight={500} fillOpacity={0.72}>{wide ? copy.sub : copy.subShort}</text>
          </g>
        );
      })}
      <text x={L.hive.x} y={L.hive.y} textAnchor={L.hive.anchor} fontSize={s.label} fontWeight={650}>{flow.hive.label}</text>
      <g fontSize={s.sub} fontWeight={500} fillOpacity={0.72}>
        <text x={L.hiveSub.x} y={L.hiveSub.y} textAnchor={L.hiveSub.anchor}>{wide ? flow.hive.sub : flow.hive.subShort}</text>
        <text x={L.question.x} y={L.question.y} textAnchor={L.question.anchor}>{flow.question}</text>
        <text x={L.lane.x} y={L.lane.y} textAnchor={L.lane.anchor}>{flow.lane[layout.name]}</text>
      </g>
    </svg>
  );
}
