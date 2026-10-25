// Gates: the only three answers a write can get. Code derives the gate from
// the action's reach and the inputs actually present — never a model.
//
//   auto    inputs known AND reach is none or data
//   ask     a required input is missing (the member is asked at run time)
//   approve money or customer — the one confirm
//
// Safety floor: money never runs auto. Enforced here, not at call sites.

export type Reach = 'none' | 'data' | 'customer' | 'money';
export type Gate = 'auto' | 'ask' | 'approve';

export interface GateAction {
  readonly reach: Reach;
  readonly requiredFields?: readonly string[];
}

export interface GateInput {
  readonly action: GateAction;
  readonly input: Record<string, unknown>;
  /** Set by the client on the second post: the member pressed Confirm. */
  readonly confirmed?: boolean;
}

const missing = (input: Record<string, unknown>, key: string) =>
  input[key] === undefined || input[key] === null || (typeof input[key] === 'string' && !input[key].trim());

export function deriveGate(request: GateInput): Gate {
  const fields = request.action.requiredFields ?? [];
  if (fields.some((key) => missing(request.input, key))) return 'ask';
  if (request.action.reach === 'money' || request.action.reach === 'customer') return 'approve';
  return 'auto';
}

/** The floor: whatever anyone derives, money never executes without the confirm. */
export function floorGate(reach: Reach, gate: Gate): Gate {
  return reach === 'money' && gate === 'auto' ? 'approve' : gate;
}

/** True when the intent may execute now; false means the member must confirm first. */
export function mayExecute(reach: Reach, gate: Gate, confirmed: boolean | undefined): boolean {
  const final = floorGate(reach, gate);
  return final === 'auto' || (final === 'approve' && confirmed === true);
}

/** The missing required fields, for the ask answer. */
export function missingFields(fields: readonly string[], input: Record<string, unknown>): string[] {
  return fields.filter((key) => missing(input, key));
}
