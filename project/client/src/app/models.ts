export interface StepEvent {
  type: string;
  ts: number;
  [key: string]: unknown;
}

export type RunStatus = 'idle' | 'running' | 'waiting' | 'calling' | 'done' | 'error';

export interface StepRow {
  id: number;
  tool?: string;
  kind: 'call' | 'result' | 'step' | 'escalation' | 'text' | 'error';
  message: string;
  ts: number;
}

export type TranscriptItem =
  | { kind: 'outbound'; id: number; body: string; ts: number }
  | { kind: 'escalating-marker'; id: number; ts: number }
  | { kind: 'call-marker'; id: number; to: string; ts: number }
  | { kind: 'inbound'; id: number; text: string; via: string; ts: number }
  | { kind: 'closing-question'; id: number; from: string; text: string; ts: number }
  | { kind: 'closing-answer'; id: number; to: string; text: string; ts: number };

/** Omit that distributes over a union first, so variant-specific fields survive. */
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
