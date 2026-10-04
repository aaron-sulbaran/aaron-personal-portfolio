// The wave's scroll conveyor, the Coil's idea applied to columns: page scroll
// feeds a target, one exponential stage closes the gap, a lead clamp keeps a
// flick from banking motion, and a speed cap keeps a fast scroll from
// aliasing the dots. Phase is in columns; the field adds it to the column
// index. Down travels the wave left (negative phase).

export const CONVEYOR = {
  pxPerColumn: 26,
  idleColumnsPerSecond: 0.4,
  leadColumns: 12,
  lambda: 11,
  capColumnsPerSecond: 40,
};

const REST_EPSILON = 1e-3;

export interface ConveyorState {
  target: number;
  phase: number;
}

export function createConveyor(): ConveyorState {
  return { target: 0, phase: 0 };
}

export function feedScroll(state: ConveyorState, deltaPx: number): void {
  if (!Number.isFinite(deltaPx)) return;
  state.target -= deltaPx / CONVEYOR.pxPerColumn;
  const lead = state.target - state.phase;
  if (lead > CONVEYOR.leadColumns) state.target = state.phase + CONVEYOR.leadColumns;
  else if (lead < -CONVEYOR.leadColumns) state.target = state.phase - CONVEYOR.leadColumns;
}

export function stepConveyor(state: ConveyorState, dt: number, idle: boolean): { moving: boolean } {
  if (idle) state.target -= CONVEYOR.idleColumnsPerSecond * dt;
  const gap = state.target - state.phase;
  if (Math.abs(gap) < REST_EPSILON) {
    state.phase = state.target;
    return { moving: false };
  }
  let step = gap * (1 - Math.exp(-CONVEYOR.lambda * dt));
  const cap = CONVEYOR.capColumnsPerSecond * dt;
  if (step > cap) step = cap;
  else if (step < -cap) step = -cap;
  state.phase += step;
  return { moving: true };
}
