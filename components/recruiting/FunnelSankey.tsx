"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { siteContent } from "@/lib/content";
import { summarizeCompanies } from "@/lib/recruiting/companies";
import { columnChain, stageBars, type Funnel, type FunnelLink, type FunnelNode } from "@/lib/recruiting/funnel";
import type { Lane } from "@/lib/recruiting/types";
import { TONES } from "./tones";

// The funnel chart. Wide containers get the Sankey; narrow ones (phones, a
// docked pane) get stacked stage bars built from the same links, because a
// Sankey needs horizontal room per column and would otherwise scroll.
//
// Sankey settings follow sankeymatic.com's Job Search recipe
// (github.com/nowthis/sankeymatic build/constants.js): node_w 8, node spacing
// near the middle of its range, flows colored by target, curvature 0.5 (the
// d3 horizontal link), flow opacity around the 0.45 default, labels showing
// name and value, ends not justified (d3 sankeyLeft) so exits sit next to the
// stage they left.

type NodeDatum = FunnelNode & { fixedValue?: number };
type LinkDatum = Pick<FunnelLink, "tone" | "byLane" | "companies">;
type LaidNode = SankeyNode<NodeDatum, LinkDatum>;
type LaidLink = SankeyLink<NodeDatum, LinkDatum>;

const NODE_WIDTH = 8;
const NARROW = 720;
const MARGIN = { top: 18, right: 132, bottom: 18, left: 108 };
const copy = siteContent.recruiting.funnel;
const laneCopy = siteContent.recruiting.lanes;

function nodeLabel(node: FunnelNode): string {
  if (node.kind === "lane") return node.lane === "outreach" ? copy.outreach : laneCopy[node.lane as Lane];
  if (node.kind === "stage" && node.stage) return copy.nodes[node.stage];
  return node.exit ? copy.exits[node.exit] : node.id;
}

function nodeTone(node: FunnelNode) {
  if (node.kind === "lane") {
    const lane = node.lane as Lane | "outreach";
    return lane === "full-time" ? TONES["lane-1"] : lane === "internship" ? TONES["lane-2"] : lane === "co-op" ? TONES["lane-3"] : TONES.node;
  }
  if (node.kind === "stage") return node.stage === "offer" || node.stage === "accepted" ? TONES.offer : TONES.node;
  return TONES[node.exit ?? "noreply"];
}

function laneBreakdown(byLane: Partial<Record<Lane, number>>): string {
  const parts = (Object.entries(byLane) as Array<[Lane, number]>)
    .filter(([, n]) => n > 0)
    .map(([lane, n]) => `${n} ${laneCopy[lane]}`);
  return parts.length > 1 ? parts.join(", ") : "";
}

interface Tip {
  x: number;
  y: number;
  title: string;
  detail: string;
  companies: string[];
}

// The companies behind a flow or node. Kept to one short paragraph: repeats
// collapse ("Google ×3") and long lists stop at a dozen with a count.
function CompanyList({ names }: { names: string[] }) {
  const { items, more } = summarizeCompanies(names);
  if (items.length === 0) return null;
  return (
    <p className="mt-1 leading-snug text-foreground/80">
      {items.join(" · ")}
      {more > 0 && <span className="text-muted"> {copy.more(more)}</span>}
    </p>
  );
}

const TIP_WIDTH = 300;

function FlowTooltip({ tip, width, height }: { tip: Tip; width: number; height: number }) {
  const flipX = tip.x + 14 + TIP_WIDTH > width;
  const flipY = tip.y > height * 0.55;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-glass-strong px-3 py-2 text-[12px] text-foreground shadow-[0_8px_20px_-12px_rgba(10,10,10,0.35)] backdrop-blur-md"
      style={{
        width: TIP_WIDTH,
        left: flipX ? Math.max(0, tip.x - 14 - TIP_WIDTH) : tip.x + 14,
        top: flipY ? undefined : tip.y + 14,
        bottom: flipY ? height - tip.y + 14 : undefined,
      }}
    >
      <p className="font-medium">{tip.title}</p>
      {tip.detail && <p className="text-muted">{tip.detail}</p>}
      <CompanyList names={tip.companies} />
    </div>
  );
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function FunnelSankey({ funnel }: { funnel: Funnel }) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const empty = funnel.counted === 0 && funnel.outreach === 0;
  return (
    <div ref={ref} className="relative">
      {empty ? (
        <p className="py-16 text-center text-sm text-muted">{copy.empty}</p>
      ) : width === 0 ? (
        <div style={{ height: 320 }} />
      ) : width < NARROW ? (
        <FunnelBars funnel={funnel} />
      ) : (
        <SankeyChart funnel={funnel} width={width} />
      )}
    </div>
  );
}

function SankeyChart({ funnel, width }: { funnel: Funnel; width: number }) {
  const [hover, setHover] = useState<Tip | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const applied = funnel.nodes.find((n) => n.id === "stage:applied")?.count ?? 0;

  const layout = useMemo(() => {
    // Height grows with the busiest column so labels never stack on each other.
    const perColumn = new Map<string, number>();
    for (const n of funnel.nodes) {
      const key = n.kind === "lane" ? "lane" : n.kind === "exit" ? `after:${n.from}` : `stage:${n.stage}`;
      perColumn.set(key, (perColumn.get(key) ?? 0) + 1);
    }
    const busiest = Math.max(...Array.from(perColumn.values()), 1);
    const height = Math.min(620, Math.max(340, 150 + busiest * 58));
    const padding = Math.max(18, Math.min(34, (height - MARGIN.top - MARGIN.bottom) * 0.09));
    const generator = sankey<NodeDatum, LinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(padding)
      .nodeAlign(sankeyLeft)
      .nodeSort((a, b) => a.rank - b.rank)
      .linkSort((a, b) => (a.target as LaidNode).rank - (b.target as LaidNode).rank)
      .iterations(32)
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, height - MARGIN.bottom],
      ]);
    const graph = generator({
      nodes: funnel.nodes.map((n) => ({ ...n, fixedValue: n.count })),
      links: [...funnel.links, ...columnChain(funnel)].map((l) => ({
        source: l.source,
        target: l.target,
        value: l.value,
        tone: l.tone,
        byLane: l.byLane,
        companies: l.companies,
      })),
    });
    return { graph, height };
  }, [funnel, width]);

  const { graph, height } = layout;
  const path = sankeyLinkHorizontal<NodeDatum, LinkDatum>();
  const touches = (link: LaidLink) =>
    !focus || (link.source as LaidNode).id === focus || (link.target as LaidNode).id === focus;
  const pct = (n: number) => (applied ? `${Math.round((n / applied) * 100)}%` : "");

  return (
    <>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block font-sans"
        role="img"
        aria-label={`${copy.heading}: ${copy.countLabel(funnel.counted)}`}
        onMouseLeave={() => {
          setHover(null);
          setFocus(null);
        }}
      >
        <g fill="none">
          {graph.links.filter((link) => link.value > 0).map((link) => {
            const s = link.source as LaidNode;
            const t = link.target as LaidNode;
            const tone = TONES[link.tone];
            const on = touches(link);
            return (
              <path
                key={`${s.id}>${t.id}`}
                d={path(link) ?? undefined}
                stroke={tone.color}
                strokeWidth={Math.max(1.5, link.width ?? 1)}
                strokeOpacity={on ? tone.flowOpacity : tone.flowOpacity * 0.25}
                className="transition-[stroke-opacity] duration-200"
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    title: `${nodeLabel(s)} ${copy.flowTo} ${nodeLabel(t)}: ${link.value}`,
                    detail: laneBreakdown(link.byLane),
                    companies: link.companies,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>

        <g>
          {graph.nodes.map((node) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y0 = node.y0 ?? 0;
            const h = Math.max(3, (node.y1 ?? 0) - y0);
            const tone = nodeTone(node);
            const label = nodeLabel(node);
            const left = node.kind === "lane";
            const tall = h >= 30;
            const cy = y0 + h / 2;
            const x = left ? x0 - 8 : x1 + 8;
            const anchor = left ? "end" : "start";
            const share = node.kind === "lane" || node.id === "stage:applied" ? "" : ` · ${pct(node.count)}`;
            const halo = { paintOrder: "stroke" as const, stroke: "var(--color-background)", strokeWidth: 4, strokeLinejoin: "round" as const };
            const dim = focus && focus !== node.id ? 0.45 : 1;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setFocus(node.id)}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    title: `${label}: ${node.count}${share}`,
                    detail: "",
                    companies: node.companies,
                  });
                }}
                onMouseLeave={() => {
                  setFocus(null);
                  setHover(null);
                }}
                style={{ opacity: dim }}
                className="transition-opacity duration-200"
              >
                {/* Wider invisible hit area: the drawn node is only 8px wide. */}
                <rect x={x0 - 8} y={y0} width={x1 - x0 + 16} height={h} fill="transparent" />
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={h}
                  rx={2}
                  fill={tone.hollow ? "none" : tone.color}
                  fillOpacity={tone.nodeOpacity}
                  stroke={tone.hollow ? tone.color : "none"}
                  strokeWidth={tone.hollow ? 1.5 : 0}
                  strokeDasharray={tone.hollow ? "3 2" : undefined}
                />
                {tall ? (
                  <text x={x} y={cy} textAnchor={anchor} className="cursor-default">
                    <tspan x={x} dy="-0.25em" className="fill-foreground text-[12.5px] font-medium" style={halo}>
                      {label}
                    </tspan>
                    <tspan x={x} dy="1.25em" className="fill-muted text-[11.5px]" style={halo}>
                      {node.count}
                      {share}
                    </tspan>
                  </text>
                ) : (
                  <text x={x} y={cy} dy="0.35em" textAnchor={anchor} className="cursor-default" style={halo}>
                    <tspan className="fill-foreground text-[12px] font-medium">{label}</tspan>
                    <tspan className="fill-muted text-[11.5px]"> {node.count}</tspan>
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hover && <FlowTooltip tip={hover} width={width} height={height} />}
    </>
  );
}

// Narrow screens: one bar per stage reached, its length the share of
// applications that got that far, split by what happened next. Same tones as
// the Sankey, 2px surface gaps between segments, 4px rounded data ends.
function FunnelBars({ funnel }: { funnel: Funnel }) {
  const bars = stageBars(funnel);
  const applied = bars.find((b) => b.stage === "applied")?.count ?? 0;
  const lanes = funnel.nodes.filter((n) => n.kind === "lane" && n.lane !== "outreach");
  const [tip, setTip] = useState<{ stage: string; tone: string } | null>(null);

  return (
    <div className="flex flex-col gap-5 py-1">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted" aria-label={copy.lanesLabel}>
        {lanes.map((n) => (
          <li key={n.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: nodeTone(n).color }} />
            <span className="text-foreground">{nodeLabel(n)}</span> {n.count}
          </li>
        ))}
      </ul>
      <ol className="flex flex-col gap-4">
        {bars.map((bar) => {
          const share = applied ? bar.count / applied : 0;
          return (
            <li key={bar.stage} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium text-foreground">{copy.nodes[bar.stage]}</span>
                <span className="text-muted">
                  {bar.count}
                  {bar.stage !== "applied" && ` · ${Math.round(share * 100)}% ${copy.ofApplied}`}
                </span>
              </div>
              <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(share * 100, 4)}%` }}>
                {bar.segments.map((seg) => {
                  const tone = TONES[seg.tone];
                  const label = `${copy.tones[seg.tone as keyof typeof copy.tones] ?? seg.tone}: ${seg.value}`;
                  const open = tip?.stage === bar.stage && tip.tone === seg.tone;
                  return (
                    <button
                      key={seg.tone}
                      type="button"
                      aria-label={label}
                      title={label}
                      aria-expanded={open}
                      onClick={() => setTip(open ? null : { stage: bar.stage, tone: seg.tone })}
                      className="h-full min-w-[4px] first:rounded-l-[4px] last:rounded-r-[4px]"
                      style={{
                        flex: `${seg.value} 0 0`,
                        background: tone.hollow ? "transparent" : tone.color,
                        opacity: tone.hollow ? 1 : Math.max(tone.nodeOpacity, 0.5),
                        border: tone.hollow ? `1.5px dashed ${tone.color}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
              {tip?.stage === bar.stage &&
                bar.segments
                  .filter((seg) => seg.tone === tip.tone)
                  .map((seg) => (
                    <div key={seg.tone} className="text-[12px]">
                      <p className="text-muted">
                        {copy.tones[seg.tone as keyof typeof copy.tones] ?? seg.tone}: {seg.value}
                      </p>
                      <CompanyList names={seg.companies} />
                    </div>
                  ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
