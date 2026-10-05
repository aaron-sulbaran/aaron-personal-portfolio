"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { siteContent } from "@/lib/content";
import { summarizeCompanies } from "@/lib/recruiting/companies";
import { columnChain, type Funnel, type FunnelLink, type FunnelNode } from "@/lib/recruiting/funnel";
import type { Lane } from "@/lib/recruiting/types";
import { TONES } from "./tones";

// The funnel chart. Wide containers draw the Sankey at their own width;
// narrow ones (phones, a docked pane) get the same chart scaled down, and
// scrolling sideways once the labels would get too small (ScaledSankey).
//
// Sankey settings follow sankeymatic.com's Job Search recipe
// (github.com/nowthis/sankeymatic build/constants.js): node_w 8, node spacing
// near the middle of its range, flows colored by target, curvature 0.5 (the
// d3 horizontal link), flow opacity around the 0.45 default, labels showing
// name and value, ends not justified (d3 sankeyLeft) so exits sit next to the
// stage they left.
//
// Referrals (2026-09-25): each flow splits into its referred and cold parts,
// and the referred part keeps its outcome color with light stripes, so a
// referral can be followed from its lane to wherever it ended.

type NodeDatum = FunnelNode & { fixedValue?: number };
type LinkDatum = Pick<FunnelLink, "tone" | "byLane" | "companies" | "referred" | "referral">;
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

// "2 internship, 1 co-op · 2 referred", either half optional.
function flowDetail(byLane: Partial<Record<Lane, number>>, referred: number): string {
  return [laneBreakdown(byLane), referred ? copy.referredCount(referred) : ""].filter(Boolean).join(" · ");
}

interface Tip {
  // Position relative to whatever element the tooltip is drawn in.
  x: number;
  y: number;
  // The pointer in viewport coordinates, for a host that draws it elsewhere.
  clientX: number;
  clientY: number;
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
  const tipWidth = Math.min(TIP_WIDTH, width);
  const flipX = tip.x + 14 + tipWidth > width;
  const flipY = tip.y > height * 0.55;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-glass-strong px-3 py-2 text-[12px] text-foreground shadow-[0_8px_20px_-12px_rgba(10,10,10,0.35)] backdrop-blur-md"
      style={{
        width: tipWidth,
        left: flipX ? Math.max(0, tip.x - 14 - tipWidth) : tip.x + 14,
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
        <ScaledSankey funnel={funnel} width={width} />
      ) : (
        <SankeyChart funnel={funnel} width={width} />
      )}
    </div>
  );
}

// Phones and narrow panes: the same chart, laid out at the narrowest width
// the wide layout ever gets and scaled down to fit, like a screenshot.
// Scaling stops at MIN_SCALE so labels stay readable (12px renders near 9px);
// past that the card scrolls sideways, each edge fading while there is more
// chart past it.
//
// When it scrolls, the tooltip is drawn here, outside the scroll area, so it
// is sized and flipped against the visible width and never clipped.
const DESIGN_WIDTH = NARROW;
const MIN_SCALE = 0.72;
// Overflow smaller than this is not worth a scroll; the chart shrinks instead.
const MIN_OVERFLOW = 12;
// Each edge fades only while there is more chart past it.
function edgeFade(fadeLeft: boolean, fadeRight: boolean): string | undefined {
  if (!fadeLeft && !fadeRight) return undefined;
  const left = fadeLeft ? "transparent, #000 32px" : "#000, #000";
  const right = fadeRight ? "#000 calc(100% - 40px), transparent" : "#000, #000";
  return `linear-gradient(to right, ${left}, ${right})`;
}

function ScaledSankey({ funnel, width }: { funnel: Funnel; width: number }) {
  const fit = width / DESIGN_WIDTH;
  const scrolls = DESIGN_WIDTH * MIN_SCALE - width > MIN_OVERFLOW;
  const scale = scrolls ? MIN_SCALE : Math.min(1, fit);
  const host = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ tip: Tip; height: number } | null>(null);
  if (!scrolls) return <SankeyChart funnel={funnel} width={DESIGN_WIDTH} scale={scale} />;
  const showTip = (next: Tip | null) => {
    const box = host.current?.getBoundingClientRect();
    if (!next || !box) return setTip(null);
    setTip({ tip: { ...next, x: next.clientX - box.left, y: next.clientY - box.top }, height: box.height });
  };
  return (
    <div ref={host} className="relative">
      {/* Keyed by width: a resize or rotation starts again at the left, fade on. */}
      <ScrollArea key={width}>
        <SankeyChart funnel={funnel} width={DESIGN_WIDTH} scale={scale} onTip={showTip} />
      </ScrollArea>
      {tip && <FlowTooltip tip={tip.tip} width={width} height={tip.height} />}
    </div>
  );
}

// The sideways scroll's own indicator, in place of the browser scrollbar: a
// thin pill under the chart that fades in while the chart moves, is hovered or
// is dragged, and fades out IDLE_MS after. It peeks once on arrival so the
// swipe is discoverable, and a mouse can drag it or click the track to jump.
// Geometry and visibility are written straight to the DOM, so scrolling never
// re-renders the chart.
const IDLE_MS = 1000;
const PEEK_MS = 1600;

function ScrollArea({ children }: { children: ReactNode }) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const fade = edgeFade(!edges.atStart, !edges.atEnd);
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ x: number; scrollLeft: number } | null>(null);

  const place = useCallback(() => {
    const el = scroller.current;
    const bar = thumb.current;
    if (!el || !bar) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const max = el.scrollWidth - el.clientWidth;
    const progress = max > 0 ? el.scrollLeft / max : 0;
    bar.style.width = `${ratio * 100}%`;
    bar.style.left = `${progress * (1 - ratio) * 100}%`;
  }, []);

  const show = useCallback((forMs: number = IDLE_MS) => {
    track.current?.setAttribute("data-shown", "true");
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!drag.current) track.current?.setAttribute("data-shown", "false");
    }, forMs);
  }, []);

  useEffect(() => {
    place();
    show(PEEK_MS);
    return () => window.clearTimeout(hideTimer.current);
  }, [place, show]);

  return (
    <>
      <div
        ref={scroller}
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atStart = el.scrollLeft <= 4;
          const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
          if (atStart !== edges.atStart || atEnd !== edges.atEnd) setEdges({ atStart, atEnd });
          place();
          show();
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      >
        {children}
      </div>
      <div
        ref={track}
        data-shown="false"
        aria-hidden="true"
        data-cursor-hover
        className="group relative mt-2 h-4 opacity-0 [touch-action:pan-y] transition-opacity duration-300 ease-[var(--ease-out)] data-[shown=true]:opacity-100 motion-reduce:transition-none"
        onPointerEnter={() => show(60_000)}
        onPointerLeave={() => show()}
        onPointerDown={(e) => {
          const el = scroller.current;
          const bar = thumb.current;
          // Touch swipes the chart itself; the pill is a mouse control.
          if (!el || !bar || e.pointerType !== "mouse") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          if (e.target !== bar) {
            // A press on the bare track centers the thumb there.
            const box = e.currentTarget.getBoundingClientRect();
            const share = (e.clientX - box.left) / box.width;
            el.scrollLeft = share * el.scrollWidth - el.clientWidth / 2;
          }
          drag.current = { x: e.clientX, scrollLeft: el.scrollLeft };
          show(60_000);
        }}
        onPointerMove={(e) => {
          const el = scroller.current;
          if (!drag.current || !el) return;
          const ratio = el.scrollWidth / e.currentTarget.getBoundingClientRect().width;
          el.scrollLeft = drag.current.scrollLeft + (e.clientX - drag.current.x) * ratio;
        }}
        onPointerUp={() => {
          drag.current = null;
          show();
        }}
        onPointerCancel={() => {
          drag.current = null;
          show();
        }}
      >
        {/* Opacity, not a /alpha color: the theme colors are CSS variables. */}
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foreground opacity-[0.08]" />
        <div
          ref={thumb}
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foreground opacity-35 transition-[height,opacity] duration-200 group-hover:h-[5px] group-hover:opacity-60"
        />
      </div>
    </>
  );
}

function SankeyChart({
  funnel,
  width,
  scale = 1,
  onTip,
}: {
  funnel: Funnel;
  width: number;
  scale?: number;
  // Given, the chart reports its tooltip instead of drawing it.
  onTip?: (tip: Tip | null) => void;
}) {
  const [hover, setHoverState] = useState<Tip | null>(null);
  const setHover = (next: Tip | null) => {
    setHoverState(next);
    onTip?.(next);
  };
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
        referred: l.referred,
        referral: l.referral,
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
    <div className="relative" style={{ width: width * scale }}>
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        className="block font-sans"
        role="img"
        aria-label={`${copy.heading}: ${copy.countLabel(funnel.counted)}`}
        onMouseLeave={() => {
          setHover(null);
          setFocus(null);
        }}
        onClick={(e) => {
          // A tap on empty space dismisses a tapped tooltip.
          if (e.target === e.currentTarget) {
            setHover(null);
            setFocus(null);
          }
        }}
      >
        <defs>
          {/* Referred part of a split flow: the flow's own color with light stripes. */}
          <pattern id="referral-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.5" height="6" fill="var(--color-background)" fillOpacity="0.55" />
          </pattern>
        </defs>
        <g fill="none">
          {graph.links.filter((link) => link.value > 0).map((link) => {
            const s = link.source as LaidNode;
            const t = link.target as LaidNode;
            const tone = TONES[link.tone];
            const on = touches(link);
            const d = path(link) ?? undefined;
            const strokeWidth = Math.max(1.5, link.width ?? 1);
            const showTip = (e: MouseEvent<SVGPathElement>) => {
              const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setHover({
                x: e.clientX - box.left,
                y: e.clientY - box.top,
                clientX: e.clientX,
                clientY: e.clientY,
                title: `${nodeLabel(s)} ${copy.flowTo} ${nodeLabel(t)}: ${link.value}`,
                detail: flowDetail(link.byLane, link.referred),
                companies: link.companies,
              });
            };
            return (
              <g key={`${s.id}>${t.id}${link.referral ? "#referral" : ""}`}>
                <path
                  d={d}
                  stroke={tone.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={on ? (link.referral ? Math.min(1, tone.flowOpacity + 0.3) : tone.flowOpacity) : tone.flowOpacity * 0.25}
                  className="transition-[stroke-opacity] duration-200"
                  onMouseMove={showTip}
                  // A tap sends a click but not always a mousemove.
                  onClick={showTip}
                  onMouseLeave={() => setHover(null)}
                />
                {link.referral && on && (
                  <path d={d} stroke="url(#referral-stripes)" strokeWidth={strokeWidth} className="pointer-events-none" />
                )}
              </g>
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
            const showTip = (e: MouseEvent<SVGGElement>) => {
              const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setHover({
                x: e.clientX - box.left,
                y: e.clientY - box.top,
                clientX: e.clientX,
                clientY: e.clientY,
                title: `${label}: ${node.count}${share}`,
                detail: node.referred ? copy.referredCount(node.referred) : "",
                companies: node.companies,
              });
            };
            return (
              <g
                key={node.id}
                onMouseEnter={() => setFocus(node.id)}
                onMouseMove={showTip}
                onClick={(e) => {
                  setFocus(node.id);
                  showTip(e);
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

      {hover && !onTip && <FlowTooltip tip={hover} width={width * scale} height={height * scale} />}
    </div>
  );
}
