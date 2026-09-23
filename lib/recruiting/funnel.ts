import {
  STAGES,
  isOffTrack,
  isOutreach,
  isPlanned,
  isStage,
  type Application,
  type Lane,
  type Season,
  type Stage,
} from "./types";

// Pure funnel math for the /recruiting chart and stat tiles. No DOM, no d3.
//
// Shape follows sankeymatic.com's own "Job Search" recipe (build/constants.js,
// job_search): lanes feed one Applications hub, each row walks the stages it
// actually reached, and every exit is its own node placed right after the
// stage it left ("Rejected" after Applied is not the same node as "Rejected"
// after Interview). That keeps exit flows short instead of dragging every
// ghosted application across the whole chart, and d3-sankey's left alignment
// then places each exit one column past its stage. Flow color follows the
// target (sankeymatic's flow_inheritfrom: target), so a flow's color says what
// happened to those applications, not which lane they came from; lane identity
// lives on the source nodes, the lane filter, and every tooltip.

export interface FunnelFilter {
  seasons: ReadonlyArray<Season>;
  lanes: ReadonlyArray<Lane> | null;
  includeOutreach: boolean;
}

export const EXITS = ["open", "rejected", "noreply", "withdrew", "ignored"] as const;
export type Exit = (typeof EXITS)[number];

export type FlowTone = "lane-1" | "lane-2" | "lane-3" | "node" | "forward" | "offer" | Exit;

export interface FunnelNode {
  id: string;
  kind: "lane" | "stage" | "exit";
  lane?: Lane | "outreach";
  stage?: Stage;
  exit?: Exit;
  // Stage the exit leaves from; also the exit's column anchor.
  from?: Stage | "outreach";
  // Sort key inside a column: stages above exits, exits in reading order.
  rank: number;
  // Applications whose path touches this node (the node's fixedValue).
  count: number;
  // Company of each of those applications (repeats kept), for the hover list.
  companies: string[];
}

export interface FunnelLink {
  source: string;
  target: string;
  value: number;
  tone: FlowTone;
  // How the flow splits by lane, for tooltips.
  byLane: Partial<Record<Lane, number>>;
  // Company of each application in the flow (repeats kept), for tooltips.
  companies: string[];
}

export interface Funnel {
  nodes: FunnelNode[];
  links: FunnelLink[];
  // Applications in the chart (planned, outreach and off-track rows excluded).
  counted: number;
  planned: number;
  outreach: number;
  // Rows that ended (withdrew, went off the search) before ever applying.
  unapplied: number;
}

const LANE_ORDER: Lane[] = ["full-time", "internship", "co-op", "?"];

export function laneOrder(lane: Lane): number {
  const i = LANE_ORDER.indexOf(lane);
  return i === -1 ? LANE_ORDER.length : i;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function laneTone(lane: Lane): FlowTone {
  switch (lane) {
    case "full-time":
      return "lane-1";
    case "internship":
      return "lane-2";
    case "co-op":
      return "lane-3";
    default:
      return "node";
  }
}

// Off-track rows (a job outside the search, like a retail job that landed in
// the recruiting label) are never part of the funnel, the tiles, or the table.
export function filterApplications(
  apps: ReadonlyArray<Application>,
  filter: FunnelFilter,
): Application[] {
  const seasons = new Set(filter.seasons);
  const lanes = filter.lanes ? new Set(filter.lanes) : null;
  return apps.filter((app) => {
    if (isOffTrack(app)) return false;
    if (!seasons.has(app.season)) return false;
    if (lanes && !lanes.has(app.lane)) return false;
    if (!filter.includeOutreach && isOutreach(app)) return false;
    return true;
  });
}

// The ordered list of stages a row actually reached: the furthest stage plus
// any stage-kind event before it. Applied is implied by any later stage (a
// referral that jumped to a screen still went through the door).
export function stagesReached(app: Application): Stage[] {
  const reached = new Set<Stage>();
  for (const event of app.events) {
    if (isStage(event.kind)) reached.add(event.kind);
  }
  if (isStage(app.furthest_stage)) reached.add(app.furthest_stage);
  if (isStage(app.outcome)) reached.add(app.outcome);
  if (reached.size === 0) return [];
  reached.add("applied");
  const furthest = isStage(app.furthest_stage)
    ? stageIndex(app.furthest_stage)
    : Math.max(...Array.from(reached, stageIndex));
  return STAGES.filter((s) => reached.has(s) && stageIndex(s) <= furthest);
}

// Where a row stopped. Stale folds into "no reply": both mean the company
// went quiet. A row still in play (or holding an offer) is "open".
export function exitFor(app: Application): Exit | null {
  // The ledger keeps accepted as a status, not an outcome; an accepted offer
  // ends on the Accepted stage with no exit.
  if (app.status === "accepted" || app.furthest_stage === "accepted") return null;
  switch (app.outcome) {
    case "rejected":
      return "rejected";
    case "ghosted":
    case "stale":
      return "noreply";
    case "withdrawn":
      return "withdrew";
    case "ignored":
      return "ignored";
    case "accepted":
      return null;
    default:
      return "open";
  }
}

export const laneNodeId = (lane: Lane | "outreach") => `lane:${lane}`;
export const stageNodeId = (stage: Stage) => `stage:${stage}`;
export const exitNodeId = (exit: Exit, from: Stage | "outreach") => `exit:${exit}@${from}`;

interface PathStep {
  id: string;
  node: Omit<FunnelNode, "count" | "companies">;
}

// One path per application: lane source, then every stage reached in order,
// then the exit node next to the last stage. Accepted offers end on the
// Accepted stage. Outreach walks Outreach -> Ignored so the toggle shows it
// without pretending those were applications.
export function pathFor(app: Application): PathStep[] {
  if (isOutreach(app)) {
    return [
      { id: laneNodeId("outreach"), node: { id: laneNodeId("outreach"), kind: "lane", lane: "outreach", rank: 99 } },
      {
        id: exitNodeId("ignored", "outreach"),
        node: { id: exitNodeId("ignored", "outreach"), kind: "exit", exit: "ignored", from: "outreach", rank: 200 },
      },
    ];
  }
  const stages = stagesReached(app);
  if (stages.length === 0) return [];
  const steps: PathStep[] = [
    { id: laneNodeId(app.lane), node: { id: laneNodeId(app.lane), kind: "lane", lane: app.lane, rank: laneOrder(app.lane) } },
    ...stages.map((stage) => ({
      id: stageNodeId(stage),
      node: { id: stageNodeId(stage), kind: "stage" as const, stage, rank: stageIndex(stage) },
    })),
  ];
  const exit = exitFor(app);
  const last = stages[stages.length - 1];
  if (exit) {
    const id = exitNodeId(exit, last);
    steps.push({ id, node: { id, kind: "exit", exit, from: last, rank: 100 + EXITS.indexOf(exit) } });
  }
  return steps;
}

function toneFor(source: Omit<FunnelNode, "count" | "companies">, target: Omit<FunnelNode, "count" | "companies">): FlowTone {
  if (source.kind === "lane") return source.lane === "outreach" ? "node" : laneTone(source.lane as Lane);
  if (target.kind === "exit") return target.exit as Exit;
  if (target.stage === "offer" || target.stage === "accepted") return "offer";
  return "forward";
}

export function computeFunnel(apps: ReadonlyArray<Application>, filter: FunnelFilter): Funnel {
  const rows = filterApplications(apps, filter);
  const nodes = new Map<string, FunnelNode>();
  const links = new Map<string, FunnelLink>();
  let counted = 0;
  let planned = 0;
  let outreach = 0;
  let unapplied = 0;

  for (const app of rows) {
    if (isPlanned(app)) {
      planned += 1;
      continue;
    }
    const path = pathFor(app);
    if (path.length === 0) {
      unapplied += 1;
      continue;
    }
    if (isOutreach(app)) outreach += 1;
    else counted += 1;
    for (const step of path) {
      const node = nodes.get(step.id) ?? { ...step.node, count: 0, companies: [] };
      node.count += 1;
      node.companies.push(app.company);
      nodes.set(step.id, node);
    }
    for (let i = 0; i + 1 < path.length; i += 1) {
      const key = `${path[i].id}>${path[i + 1].id}`;
      const link = links.get(key) ?? {
        source: path[i].id,
        target: path[i + 1].id,
        value: 0,
        tone: toneFor(path[i].node, path[i + 1].node),
        byLane: {},
        companies: [],
      };
      link.value += 1;
      link.companies.push(app.company);
      link.byLane[app.lane] = (link.byLane[app.lane] ?? 0) + 1;
      links.set(key, link);
    }
  }

  const nodeList = Array.from(nodes.values()).sort((a, b) => a.rank - b.rank);
  const rankOf = (id: string) => nodes.get(id)?.rank ?? 0;
  const linkList = Array.from(links.values()).sort(
    (a, b) => rankOf(a.source) - rankOf(b.source) || rankOf(a.target) - rankOf(b.target),
  );
  return { nodes: nodeList, links: linkList, counted, planned, outreach, unapplied };
}

// Zero-value links chaining the stages present, in stage order. d3-sankey
// assigns columns by path length, so a row that jumped straight from Applied
// to an offer would otherwise put Offer in the OA column. With the chain, each
// present stage gets its own column in order and each exit sits one column
// past its stage, which is sankeymatic's job-search layout. The chart draws
// only links with a value, so the chain is invisible.
export function columnChain(funnel: Funnel): FunnelLink[] {
  const present = funnel.nodes
    .filter((n) => n.kind === "stage" && n.stage)
    .map((n) => n.stage as Stage)
    .sort((a, b) => stageIndex(a) - stageIndex(b));
  const chain: FunnelLink[] = [];
  for (let i = 0; i + 1 < present.length; i += 1) {
    const source = stageNodeId(present[i]);
    const target = stageNodeId(present[i + 1]);
    if (!funnel.links.some((l) => l.source === source && l.target === target)) {
      chain.push({ source, target, value: 0, tone: "forward", byLane: {}, companies: [] });
    }
  }
  return chain;
}

// Per-stage breakdown for the narrow-screen bars: how many reached each stage
// and where they went next (forward, still open, or which exit).
export interface StageBar {
  stage: Stage;
  count: number;
  segments: Array<{ tone: FlowTone; value: number; companies: string[] }>;
}

export function stageBars(funnel: Funnel): StageBar[] {
  const bars: StageBar[] = [];
  for (const node of funnel.nodes) {
    if (node.kind !== "stage" || !node.stage) continue;
    const out = funnel.links.filter((l) => l.source === node.id);
    const byTone = new Map<FlowTone, number>();
    const namesByTone = new Map<FlowTone, string[]>();
    for (const link of out) {
      const tone = link.tone === "offer" ? "forward" : link.tone;
      byTone.set(tone, (byTone.get(tone) ?? 0) + link.value);
      namesByTone.set(tone, [...(namesByTone.get(tone) ?? []), ...link.companies]);
    }
    const order: FlowTone[] = ["forward", "open", "rejected", "noreply", "withdrew"];
    bars.push({
      stage: node.stage,
      count: node.count,
      segments: order
        .filter((t) => byTone.has(t))
        .map((t) => ({ tone: t, value: byTone.get(t) as number, companies: namesByTone.get(t) ?? [] })),
    });
  }
  return bars.sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));
}

export interface FunnelStats {
  applications: number;
  responseRate: number | null;
  interviewRate: number | null;
  offers: number;
  medianResponseDays: number | null;
}

// Rates are over funnel rows (applied at least once). Outreach, planned and
// off-track rows never count as applications. An offer counts only when the
// row reached the offer stage on the ledger, which the vault CLI allows only
// with a sourced offer event (talos-ledger OFFER-CHECK).
export function computeStats(apps: ReadonlyArray<Application>, filter: FunnelFilter): FunnelStats {
  const rows = filterApplications(apps, { ...filter, includeOutreach: false }).filter(
    (app) => !isPlanned(app) && stagesReached(app).length > 0,
  );
  const applications = rows.length;
  const responded = rows.filter(
    (app) =>
      app.first_response_days !== null ||
      furthestIndex(app) > stageIndex("applied") ||
      app.outcome === "rejected",
  ).length;
  const interviewed = rows.filter((app) => furthestIndex(app) >= stageIndex("interview")).length;
  const offers = rows.filter((app) => furthestIndex(app) >= stageIndex("offer")).length;
  const days = rows
    .map((app) => app.first_response_days)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  return {
    applications,
    responseRate: applications ? responded / applications : null,
    interviewRate: applications ? interviewed / applications : null,
    offers,
    medianResponseDays: median(days),
  };
}

function furthestIndex(app: Application): number {
  const stages = stagesReached(app);
  return stages.length ? stageIndex(stages[stages.length - 1]) : -1;
}

export function median(sorted: ReadonlyArray<number>): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
