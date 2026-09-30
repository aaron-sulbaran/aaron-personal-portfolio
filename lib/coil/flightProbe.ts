// The flight's measurement hook, QA only: ?coildebug=flight. It records what
// happens on which animation frame around every swap between the card's mesh
// and the flying clone (the clone mounts, the mesh hides, the clone lands, the
// mesh shows, the scene resumes), and lets a test hold the flight still at a
// swap so both sides of it can be captured and compared pixel by pixel.
// Without the token nothing is created and every call is a null check.

export type FlightMark = { name: string; frame: number; at: number; data?: unknown };

export type FlightProbe = {
  // The flight clock's rate: 1 is real time, 0 holds the clone where it is.
  rate: number;
  // Closing: the clone stays on its home quad until this is cleared.
  holdLanding: boolean;
  // Animation frames since the probe started.
  frame: number;
  log: FlightMark[];
  mark: (name: string, data?: unknown) => void;
  // Set by the scene: its live state, for the harness.
  scene: Record<string, (...args: never[]) => unknown>;
};

const LOG_LIMIT = 4000;
let probe: FlightProbe | null | undefined;

export function flightProbe(): FlightProbe | null {
  if (probe !== undefined) return probe;
  if (typeof window === "undefined") return null;
  const tokens = (new URLSearchParams(window.location.search).get("coildebug") ?? "").split(",");
  if (!tokens.some((token) => token.trim() === "flight")) {
    probe = null;
    return probe;
  }
  const created: FlightProbe = {
    rate: 1,
    holdLanding: false,
    frame: 0,
    log: [],
    mark(name, data) {
      created.log.push({ name, frame: created.frame, at: performance.now(), data });
      if (created.log.length > LOG_LIMIT) created.log.shift();
    },
    scene: {},
  };
  const tick = () => {
    created.frame += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  (window as unknown as { __coilFlight?: FlightProbe }).__coilFlight = created;
  probe = created;
  return probe;
}
