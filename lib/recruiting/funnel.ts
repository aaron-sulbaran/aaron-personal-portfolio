import {
  STAGES,
  isOutreach,
  isPlanned,
  isStage,
  isTerminal,
  type Application,
  type Lane,
  type Season,
  type Stage,
  type Terminal,
} from "./types";

// Pure funnel math for the /recruiting Sankey and stat tiles. No DOM, no d3;
// the chart component feeds the output straight into d3-sankey.

export interface FunnelFilter {
  seasons: ReadonlyArray<Season>;
  lanes: ReadonlyArray<Lane> | null;
  includeOutreach: boolean;
}

export type FunnelNodeId = Stage | Terminal | "outreach";

export interface FunnelNode {
  id: FunnelNodeId;
  kind: "stage" | "terminal" | "source";
  order: number;
  // Applications whose path touches this node. Becomes the node's fixedValue
  // in d3-sankey so a stage where rows stop (still in play) is drawn at its
  // true height, taller than its outflows.
  count: number;
}

export interface FunnelLink {
  source: FunnelNodeId;
  target: FunnelNodeId;
  lane: Lane;
  value: number;
}

export interface Funnel {
  nodes: FunnelNode[];
  links: FunnelLink[];
  counted: number;
  planned: number;
}

const TERMINAL_ORDER: Terminal[] = ["rejected", "ghosted", "withdrawn", "stale", "ignored"];

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function filterApplications(
  apps: ReadonlyArray<Application>,
  filter: FunnelFilter,
): Application[] {
  const seasons = new Set(filter.seasons);
  const lanes = filter.lanes ? new Set(filter.lanes) : null;
  return apps.filter((app) => {
    if (!seasons.has(app.season)) return false;
    if (lanes && !lanes.has(app.lane)) return false;
    if (!filter.includeOutreach && isOutreach(app)) return false;
    return true;
  });
}

// The ordered list of stages a row actually reached: the furthest stage on the
// row plus any stage-kind event before it. Applied is implied by any later
// stage even when the ledger holds no explicit applied event (a referral that
// jumped straight to a screen still went through the door).
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

// One Sankey path per application: through every stage it reached in order,
// then into a terminal node when its outcome is one. A row still in play ends
// at its furthest stage. Ignored outreach flows outreach -> ignored so the
// toggle has something to show without pretending those were applications.
export function pathFor(app: Application): FunnelNodeId[] {
  if (isOutreach(app)) return ["outreach", "ignored"];
  const stages = stagesReached(app);
  if (stages.length === 0) return [];
  const path: FunnelNodeId[] = [...stages];
  if (isTerminal(app.outcome)) path.push(app.outcome);
  return path;
}

export function computeFunnel(apps: ReadonlyArray<Application>, filter: FunnelFilter): Funnel {
  const rows = filterApplications(apps, filter);
  const linkTotals = new Map<string, FunnelLink>();
  const seen = new Map<FunnelNodeId, number>();
  let counted = 0;
  let planned = 0;

  for (const app of rows) {
    if (isPlanned(app)) {
      planned += 1;
      continue;
    }
    const path = pathFor(app);
    if (path.length === 0) continue;
    counted += 1;
    for (const id of path) seen.set(id, (seen.get(id) ?? 0) + 1);
    for (let i = 0; i + 1 < path.length; i += 1) {
      const key = `${path[i]}>${path[i + 1]}>${app.lane}`;
      const link = linkTotals.get(key) ?? {
        source: path[i],
        target: path[i + 1],
        lane: app.lane,
        value: 0,
      };
      link.value += 1;
      linkTotals.set(key, link);
    }
  }

  const nodes: FunnelNode[] = [];
  const count = (id: FunnelNodeId) => seen.get(id) ?? 0;
  if (seen.has("outreach")) nodes.push({ id: "outreach", kind: "source", order: -1, count: count("outreach") });
  STAGES.forEach((stage, i) => nodes.push({ id: stage, kind: "stage", order: i, count: count(stage) }));
  TERMINAL_ORDER.forEach((terminal, i) => {
    if (seen.has(terminal)) nodes.push({ id: terminal, kind: "terminal", order: 100 + i, count: count(terminal) });
  });

  const links = Array.from(linkTotals.values()).sort(
    (a, b) =>
      nodeOrder(a.source) - nodeOrder(b.source) ||
      nodeOrder(a.target) - nodeOrder(b.target) ||
      laneOrder(a.lane) - laneOrder(b.lane),
  );

  return { nodes, links, counted, planned };
}

function nodeOrder(id: FunnelNodeId): number {
  if (id === "outreach") return -1;
  if (isStage(id)) return stageIndex(id);
  return 100 + TERMINAL_ORDER.indexOf(id);
}

const LANE_ORDER: Lane[] = ["full-time", "internship", "co-op", "?"];
export function laneOrder(lane: Lane): number {
  const i = LANE_ORDER.indexOf(lane);
  return i === -1 ? LANE_ORDER.length : i;
}

export interface FunnelStats {
  applications: number;
  responseRate: number | null;
  interviewRate: number | null;
  offers: number;
  medianResponseDays: number | null;
}

// Rates are over funnel rows (applied at least once); outreach and planned
// rows never count as applications even when the outreach toggle is on.
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
