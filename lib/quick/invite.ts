// The first-visit invite to the Express lane (the spec's "The first-visit
// invite"): which pieces play, and when they may show. Pure; the storage
// helpers guard every access and never throw.
//
//   pill   A, the corner pill at the hero's bottom right
//   toast  C, the toast at the bottom right
//   both   A plus C (the production default until I pick)
//   line   B, the hero's own one-time line at the bottom centre

export type InviteMode = "pill" | "toast" | "both" | "line";
export type InviteAnswer = "used" | "dismissed";

export const INVITE_MODES: readonly InviteMode[] = ["pill", "toast", "both", "line"];
export const DEFAULT_INVITE_MODE: InviteMode = "both";

// Once answered (used or dismissed), never again. Bump the version to ask everyone again.
export const INVITE_KEY = "aaron-express-invite-v1";
// The lab's pick; read only in development.
export const INVITE_MODE_KEY = "lab-express-invite-mode";

export const INVITE_TIMING = { delayMs: 1500, lineHoldMs: 4000 } as const;

export function parseInviteMode(raw: string | null): InviteMode | null {
  return INVITE_MODES.includes(raw as InviteMode) ? (raw as InviteMode) : null;
}

export function inviteModeFor({ development, override }: { development: boolean; override: string | null }): InviteMode {
  return (development && parseInviteMode(override)) || DEFAULT_INVITE_MODE;
}

export function invitePieces(mode: InviteMode): { pill: boolean; toast: boolean; line: boolean } {
  return { pill: mode === "pill" || mode === "both", toast: mode === "toast" || mode === "both", line: mode === "line" };
}

export interface InviteGate {
  holding: boolean;
  // The home's readiness (lib/home/readiness): the loader and the entrance are "pre" and "entering".
  phase: "pre" | "entering" | "ready";
  // The entrance has played or was skipped (the controller's entrance is set).
  rested: boolean;
  // This load landed past the hero (a section hash or a saved position).
  deep: boolean;
  modalOpen: boolean;
  flying: boolean;
  transitioning: boolean;
  answered: boolean;
}

// Whether this visit may arm the invite at all: once false it stays false for the page load.
export function inviteEligible(gate: Pick<InviteGate, "holding" | "deep" | "answered">): boolean {
  return !gate.holding && !gate.deep && !gate.answered;
}

// Whether the invite may be on screen right now.
export function inviteMayShow(gate: InviteGate): boolean {
  return inviteEligible(gate) && gate.phase === "ready" && gate.rested && !gate.modalOpen && !gate.flying && !gate.transitioning;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export function readAnswered(storage: Store | null): boolean {
  try {
    const value = storage?.getItem(INVITE_KEY);
    return value === "used" || value === "dismissed";
  } catch {
    return false;
  }
}

export function writeAnswer(storage: Store | null, answer: InviteAnswer): void {
  try {
    storage?.setItem(INVITE_KEY, answer);
  } catch {
    // Blocked storage: the invite may ask again next visit.
  }
}
