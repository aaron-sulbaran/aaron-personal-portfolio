"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { siteContent } from "@/lib/content";
import { laneOrder, stageIndex, type Funnel, type FunnelLink, type FunnelNode, type FunnelNodeId } from "@/lib/recruiting/funnel";
import { laneTone } from "@/lib/recruiting/format";
import { STAGES, type Lane } from "@/lib/recruiting/types";

// The funnel, laid out by d3-sankey. Conventions after sankeymatic: stages in
// order left to right, sources left-aligned, terminal outcomes pinned to the
// right edge, flows carry the lane color and a count, nodes stay muted.
//
// d3-sankey assigns columns by graph depth, so the seven stages are always
// present (zero-value scaffold links keep the chain unbroken, see scaffold())
// and terminals ask for the last column via nodeAlign. Their vertical layout
// is d3's; the horizontal positions are then rewritten so terminals get a
// column of their own at the right edge regardless of where each flow ended.

type NodeDatum = FunnelNode & { label: string; value?: number; fixedValue?: number };
type LinkDatum = { lane: Lane; scaffold: boolean };
type LaidNode = SankeyNode<NodeDatum, LinkDatum>;
type LaidLink = SankeyLink<NodeDatum, LinkDatum>;

const NODE_WIDTH = 10;
const NODE_PADDING = 22;
const HEIGHT = 380;
const MIN_WIDTH = 720;
const MARGIN = { top: 34, right: 96, bottom: 14, left: 12 };

const copy = siteContent.recruiting.funnel;

function scaffold(links: FunnelLink[]): Array<FunnelLink & { scaffold: boolean }> {
  const real = links.map((l) => ({ ...l, scaffold: false }));
  const present = new Set(real.map((l) => `${l.source}>${l.target}`));
  const chain: Array<FunnelLink & { scaffold: boolean }> = [];
  for (let i = 0; i + 1 < STAGES.length; i += 1) {
    const key = `${STAGES[i]}>${STAGES[i + 1]}`;
    if (!present.has(key)) {
      chain.push({ source: STAGES[i], target: STAGES[i + 1], lane: "?", value: 0, scaffold: true });
    }
  }
  return [...real, ...chain];
}

// Stage names run along the top as column headers, so an empty stage still
// shows where the road goes; terminals share one "Outcome" column.
function columnHeaders(width: number) {
  const columns = STAGES.length + 1;
  const step = (width - MARGIN.left - MARGIN.right - NODE_WIDTH) / (columns - 1);
  const labels = [...STAGES.map((s) => copy.nodes[s]), copy.outcomeHeader];
  return labels.map((label, i) => ({
    label,
    x: MARGIN.left + i * step + (i === 0 ? 0 : i === columns - 1 ? NODE_WIDTH : NODE_WIDTH / 2),
    anchor: (i === 0 ? "start" : i === columns - 1 ? "end" : "middle") as "start" | "end" | "middle",
  }));
}

function columnOf(node: NodeDatum): number {
  if (node.kind === "terminal") return STAGES.length;
  if (node.kind === "source") return 0;
  return stageIndex(node.id as (typeof STAGES)[number]);
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
  const { ref, width: measured } = useMeasuredWidth<HTMLDivElement>();
  const width = Math.max(measured, MIN_WIDTH);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [focusNode, setFocusNode] = useState<FunnelNodeId | null>(null);

  const layout = useMemo(() => {
    if (funnel.counted === 0) return null;
    const nodes: NodeDatum[] = funnel.nodes.map((n) => ({
      ...n,
      label: copy.nodes[n.id],
      fixedValue: n.count > 0 ? n.count : undefined,
    }));
    const links = scaffold(funnel.links);
    const generator = sankey<NodeDatum, LinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .iterations(32)
      .nodeAlign((node, n) => (node.kind === "terminal" ? n - 1 : node.depth ?? 0))
      .nodeSort((a, b) => a.order - b.order)
      .linkSort((a, b) => laneOrder(a.lane) - laneOrder(b.lane))
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, HEIGHT - MARGIN.bottom],
      ]);
    const graph = generator({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ source: l.source, target: l.target, value: l.value, lane: l.lane, scaffold: l.scaffold })),
    });
    const columns = STAGES.length + 1;
    const step = (width - MARGIN.left - MARGIN.right - NODE_WIDTH) / (columns - 1);
    for (const node of graph.nodes) {
      node.x0 = MARGIN.left + columnOf(node) * step;
      node.x1 = node.x0 + NODE_WIDTH;
    }
    return graph;
  }, [funnel, width]);

  if (!layout) {
    return (
      <p className="py-16 text-center text-sm text-muted">{copy.empty}</p>
    );
  }

  const path = sankeyLinkHorizontal<NodeDatum, LinkDatum>();
  const realLinks = layout.links.filter((l) => !l.scaffold && l.value > 0);
  const connected = (link: LaidLink) => {
    if (!focusNode) return true;
    const s = link.source as LaidNode;
    const t = link.target as LaidNode;
    return s.id === focusNode || t.id === focusNode;
  };

  return (
    <div ref={ref} className="relative -mx-2 overflow-x-auto px-2">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block font-sans"
        role="img"
        aria-label={copy.heading}
        onMouseLeave={() => {
          setHover(null);
          setFocusNode(null);
        }}
      >
        <g fill="none">
          {realLinks.map((link) => {
            const s = link.source as LaidNode;
            const t = link.target as LaidNode;
            const tone = laneTone(link.lane);
            const active = connected(link);
            return (
              <path
                key={`${s.id}-${t.id}-${link.lane}`}
                d={path(link) ?? undefined}
                stroke={`var(--viz-${tone})`}
                strokeWidth={Math.max(1, link.width ?? 1)}
                strokeOpacity={active ? 0.55 : 0.12}
                className="transition-[stroke-opacity] duration-200"
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    text: `${s.label} to ${t.label}: ${link.value} ${siteContent.recruiting.lanes[link.lane]}`,
                  });
                }}
              />
            );
          })}
        </g>

        <g>
          {realLinks.map((link) => {
            if ((link.width ?? 0) < 10) return null;
            const s = link.source as LaidNode;
            const t = link.target as LaidNode;
            const x = ((s.x1 ?? 0) + (t.x0 ?? 0)) / 2;
            const y = ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2;
            return (
              <text
                key={`n-${s.id}-${t.id}-${link.lane}`}
                x={x}
                y={y}
                dy="0.35em"
                textAnchor="middle"
                className="fill-foreground text-[11px] font-medium"
                style={{ paintOrder: "stroke", stroke: "var(--color-background)", strokeWidth: 3, opacity: connected(link) ? 1 : 0.2 }}
                pointerEvents="none"
              >
                {link.value}
              </text>
            );
          })}
        </g>

        <g>
          {columnHeaders(width).map((header) => (
            <text
              key={header.label}
              x={header.x}
              y={12}
              dy="0.35em"
              textAnchor={header.anchor}
              className="fill-muted text-[10px] font-medium uppercase tracking-caps"
            >
              {header.label}
            </text>
          ))}
          {layout.nodes.map((node) => {
            if (node.count === 0) return null;
            const x0 = node.x0 ?? 0;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 0;
            const terminal = node.kind === "terminal";
            const tone = terminal ? (node.id === "ignored" ? "node" : "cool")
              : node.id === "offer" || node.id === "accepted" ? "warm"
              : "node";
            return (
              <g
                key={node.id}
                onMouseEnter={() => setFocusNode(node.id)}
                onMouseLeave={() => setFocusNode(null)}
              >
                <rect
                  x={x0}
                  y={y0}
                  width={NODE_WIDTH}
                  height={Math.max(2, y1 - y0)}
                  rx={2}
                  fill={`var(--viz-${tone})`}
                  fillOpacity={tone === "node" ? 0.55 : 0.9}
                />
                <title>{`${node.label}: ${node.count}`}</title>
                {terminal ? (
                  <text
                    x={x0 + NODE_WIDTH + 8}
                    y={(y0 + y1) / 2}
                    dy="0.35em"
                    className="fill-foreground text-[12px] font-medium"
                  >
                    {node.label}
                    <tspan className="fill-muted font-normal"> {node.count}</tspan>
                  </text>
                ) : (
                  <text
                    x={x0 + NODE_WIDTH / 2}
                    y={y0 - 5}
                    textAnchor="middle"
                    className="fill-foreground text-[12px] font-semibold"
                    style={{ paintOrder: "stroke", stroke: "var(--color-background)", strokeWidth: 3 }}
                  >
                    {node.count}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-glass-strong px-2.5 py-1.5 text-[12px] text-foreground shadow-[0_8px_20px_-12px_rgba(10,10,10,0.35)] backdrop-blur-md"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
