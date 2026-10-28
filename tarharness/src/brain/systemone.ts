/**
 * One System One client for every Jev judgment in the harness.
 *
 * Jev answers typed questions about supplied state; it never writes site JSON,
 * grants permission or decides policy. Callers choose their timeout and how a
 * failure is surfaced, so existing behaviour stays intact.
 */

export const JEV_MODEL = 'jev-latest';
export const SYSTEM_ONE_URL = 'https://api.typesafe.ai/v1/systemone';

export interface SystemOneQuestion {
  readonly type: 'choice' | 'score' | 'noul';
  readonly instructions: string;
  readonly criteria?: Record<string, string> | readonly string[];
}

export interface SystemOneRequest {
  readonly state: Record<string, unknown>;
  readonly questions: Record<string, SystemOneQuestion>;
  readonly model?: string;
  readonly timeout?: number;
}

export type SystemOneFailureKind = 'unconfigured' | 'unreachable' | 'busy' | 'rejected' | 'invalid';

export interface SystemOneFailure {
  readonly kind: SystemOneFailureKind;
  readonly status?: number;
  readonly cause?: unknown;
}

export interface SystemOneResult {
  readonly model: string;
  readonly answers: Record<string, Record<string, unknown>>;
}

export type SystemOneOutcome = { ok: true; value: SystemOneResult } | { ok: false; failure: SystemOneFailure };

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function askSystemOne(apiKey: string | undefined, request: SystemOneRequest): Promise<SystemOneOutcome> {
  if (!apiKey) return { ok: false, failure: { kind: 'unconfigured' } };
  let response: Response;
  try {
    response = await fetch(SYSTEM_ONE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || JEV_MODEL,
        state: request.state,
        // Jev takes criteria as a map of label → description; arrays are a 422.
        questions: Object.fromEntries(Object.entries(request.questions).map(([key, question]) => [
          key,
          question.criteria && Array.isArray(question.criteria)
            ? { ...question, criteria: Object.fromEntries(question.criteria.map((value) => [value, value])) }
            : question,
        ])),
      }),
      signal: AbortSignal.timeout(request.timeout ?? 8_000),
    });
  } catch (cause) {
    return { ok: false, failure: { kind: 'unreachable', cause } };
  }
  if (!response.ok) {
    const busy = response.status === 429 || response.status === 529 || response.status >= 500;
    return { ok: false, failure: { kind: busy ? 'busy' : 'rejected', status: response.status } };
  }
  let payload: Record<string, unknown>;
  try { payload = object(await response.json()); }
  catch (cause) { return { ok: false, failure: { kind: 'invalid', cause } }; }
  const raw = object(payload.answers);
  return {
    ok: true,
    value: {
      model: typeof payload.model === 'string' ? payload.model : request.model || JEV_MODEL,
      answers: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, object(value)])),
    },
  };
}

export interface ChoiceAnswer {
  readonly choice: string | null;
  readonly confidence: number | null;
  readonly probabilities: Record<string, number>;
}

/** Read a Choice answer. Confidence is distribution concentration, not correctness. */
export function choiceOf(answer: Record<string, unknown> | undefined): ChoiceAnswer {
  const raw = object(answer);
  const probabilities = object(raw.probabilities);
  return {
    choice: typeof raw.choice === 'string' ? raw.choice : null,
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : null,
    probabilities: Object.fromEntries(Object.entries(probabilities).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)) as [string, number][]),
  };
}

export interface ScoreAnswer {
  readonly score: number | null;
  readonly confidence: number | null;
}

export function scoreOf(answer: Record<string, unknown> | undefined): ScoreAnswer {
  const raw = object(answer);
  return {
    score: typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : null,
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : null,
  };
}

export interface NoulAnswer {
  /** Probability of yes; Noul has no separate confidence. */
  readonly probability: number | null;
  readonly labels: Record<string, number>;
}

export function noulOf(answer: Record<string, unknown> | undefined): NoulAnswer {
  const raw = object(answer);
  const labels = object(raw.labels);
  return {
    probability: typeof raw.probability === 'number' && Number.isFinite(raw.probability) ? raw.probability : null,
    labels: Object.fromEntries(Object.entries(labels).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)) as [string, number][]),
  };
}
