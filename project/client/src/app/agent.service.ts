import { Injectable, computed, signal } from '@angular/core';
import type { DistributiveOmit, RunStatus, StepEvent, StepRow, TranscriptItem } from './models';

const EVENT_TYPES = [
  'run-start',
  'tool-call',
  'tool-result',
  'step',
  'message-sent',
  'waiting',
  'escalating',
  'calling',
  'reply',
  'no-reply',
  'applied',
  'text',
  'error',
  'done',
  'closing-question',
  'closing-answer',
] as const;

let nextId = 1;

/**
 * Plain-English names for the agent's tools. The right-hand pane is read by
 * people watching a talk, not by anyone debugging -- `checkAudience({})` tells
 * them nothing, "Working out who this reaches" tells them everything.
 */
const TOOL_LABELS: Record<string, string> = {
  checkAudience: 'Working out who this reaches',
  askHuman: 'Asking a human',
  sendTheNotice: 'Sending the notice',
};

/**
 * Every real outbound text arrives as the same 'message-sent' event --
 * distinguished only by this label, so the right pane reads as a record of
 * what was actually said instead of the same line three times over.
 */
const MESSAGE_SENT_LABELS: Record<string, string> = {
  question: 'Texted the human on WhatsApp',
  clarify: 'Asked the human to be clearer',
  confirmation: 'Confirmed the outcome by text',
};

@Injectable({ providedIn: 'root' })
export class AgentService {
  readonly status = signal<RunStatus>('idle');
  readonly mock = signal(false);
  /** Real Twilio, but no model key -- the escalation is an `if`, not a decision. */
  readonly noModel = signal(false);
  readonly steps = signal<StepRow[]>([]);
  readonly transcript = signal<TranscriptItem[]>([]);
  readonly waitingElapsed = signal<number | null>(null);
  readonly outcome = signal<{ sentNow: number; scheduled: number; held: boolean; canceled: boolean } | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isBusy = computed(() =>
    ['running', 'waiting', 'calling'].includes(this.status()),
  );

  private source: EventSource | null = null;

  async checkHealth(): Promise<void> {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      this.mock.set(Boolean(data.mock));
      this.noModel.set(Boolean(data['noModel']));
    } catch {
      // health check is best-effort; UI still works without it
    }
  }

  async run(prompt: string): Promise<void> {
    this.reset();
    this.status.set('running');

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      this.status.set('error');
      this.errorMessage.set(`Failed to start run (HTTP ${res.status})`);
      return;
    }

    const { runId } = await res.json();
    this.attach(runId);
  }

  private attach(runId: string) {
    this.source?.close();
    const source = new EventSource(`/api/stream/${runId}`);
    this.source = source;

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (evt) => {
        const data = JSON.parse((evt as MessageEvent).data) as StepEvent;
        this.handle(data);
      });
    }

    source.onerror = () => {
      if (this.status() === 'running' || this.status() === 'waiting' || this.status() === 'calling') {
        // EventSource auto-retries; only surface a hard error if we never reach 'done'.
      }
    };
  }

  private reset() {
    this.source?.close();
    this.source = null;
    this.steps.set([]);
    this.transcript.set([]);
    this.waitingElapsed.set(null);
    this.outcome.set(null);
    this.errorMessage.set(null);
  }

  private pushStep(row: Omit<StepRow, 'id'>) {
    this.steps.update((rows) => [...rows, { ...row, id: nextId++ }]);
  }

  private pushTranscript(item: DistributiveOmit<TranscriptItem, 'id'>) {
    this.transcript.update((items) => [...items, { ...item, id: nextId++ } as TranscriptItem]);
  }

  private handle(event: StepEvent) {
    switch (event.type) {
      case 'run-start':
        this.pushStep({ kind: 'call', message: `Task received: "${event['prompt']}"`, ts: event.ts });
        break;

      case 'tool-call': {
        const tool = String(event['tool']);
        this.pushStep({
          tool,
          kind: 'phase',
          message: TOOL_LABELS[tool] ?? tool,
          ts: event.ts,
        });
        break;
      }

      // Deliberately not shown. The raw result is a JSON blob, and every
      // meaningful thing in it already arrives as its own `step` event in
      // readable English. Dumping it here made the pane look like a console.
      case 'tool-result':
        break;

      case 'step':
        this.pushStep({
          tool: String(event['tool']),
          kind: event['severity'] === 'irreversible' ? 'escalation' : 'step',
          message: String(event['message']),
          ts: event.ts,
        });
        break;

      case 'message-sent': {
        // Every real outbound text lands here -- the question, a
        // clarify-and-retry, and the closing confirmation -- and without a
        // kind they all produced the identical step "Texted the human on
        // WhatsApp", making the right pane unreadable as a record of what
        // was actually said. Only the first two are actually awaiting a
        // reply; the confirmation is the run wrapping up, not a new wait.
        const kind = String(event['kind'] ?? 'question');
        if (kind !== 'confirmation') this.status.set('waiting');
        this.pushTranscript({ kind: 'outbound', body: String(event['body']), ts: event.ts });
        this.pushStep({
          tool: 'askHuman',
          kind: 'step',
          message: `${MESSAGE_SENT_LABELS[kind] ?? MESSAGE_SENT_LABELS['question']} (${event['to']})`,
          ts: event.ts,
        });
        break;
      }

      case 'waiting':
        this.waitingElapsed.set(Number(event['elapsedSec']));
        break;

      case 'escalating':
        this.status.set('calling');
        this.pushTranscript({ kind: 'escalating-marker', ts: event.ts });
        this.pushStep({
          tool: 'askHuman',
          kind: 'escalation',
          message: String(event['message'] ?? 'no answer — escalating to voice'),
          ts: event.ts,
        });
        break;

      case 'calling':
        this.waitingElapsed.set(null);
        this.pushTranscript({ kind: 'call-marker', to: String(event['to']), ts: event.ts });
        // "No reply" already appeared a beat ago on the 'escalating' row
        // right above this one -- repeating it here just for the row to
        // read as two rows saying the same thing.
        this.pushStep({ tool: 'askHuman', kind: 'escalation', message: `Calling ${event['to']}…`, ts: event.ts });
        break;

      case 'reply':
        this.status.set('running');
        this.waitingElapsed.set(null);
        this.pushTranscript({ kind: 'inbound', text: String(event['text']), via: String(event['via']), ts: event.ts });
        this.pushStep({ tool: 'askHuman', kind: 'step', message: `The human said: "${event['text']}"`, ts: event.ts });
        break;

      // Both channels went unanswered. Not a fake reply -- a distinct marker,
      // so the transcript never implies the human said something they didn't.
      case 'no-reply':
        this.status.set('running');
        this.waitingElapsed.set(null);
        this.pushTranscript({ kind: 'no-reply-marker', ts: event.ts });
        this.pushStep({
          tool: 'askHuman',
          kind: 'escalation',
          message: 'No response on either channel — holding everyone until morning by default',
          ts: event.ts,
        });
        break;

      case 'applied':
        this.outcome.set({
          sentNow: Number(event['sentNow'] ?? 0),
          scheduled: Number(event['scheduled'] ?? 0),
          held: Boolean(event['held']),
          canceled: Boolean(event['canceled']),
        });
        break;

      // The model streams prose a few characters at a time. One row per chunk
      // turns the pane into confetti, so append into the row already open.
      case 'text': {
        const delta = String(event['delta'] ?? '');
        if (!delta) break;
        this.steps.update((rows) => {
          const last = rows[rows.length - 1];
          if (last?.kind === 'text') {
            return [...rows.slice(0, -1), { ...last, message: last.message + delta }];
          }
          return [...rows, { kind: 'text', message: delta, ts: event.ts, id: nextId++ }];
        });
        break;
      }

      case 'error':
        this.status.set('error');
        this.errorMessage.set(String(event['message']));
        this.pushStep({ kind: 'error', message: String(event['message']), ts: event.ts });
        break;

      case 'done':
        this.status.set('done');
        break;

      case 'closing-question':
        this.pushTranscript({
          kind: 'closing-question',
          from: String(event['from']),
          text: String(event['text']),
          ts: event.ts,
        });
        break;

      case 'closing-answer':
        this.pushTranscript({
          kind: 'closing-answer',
          to: String(event['to']),
          text: String(event['text']),
          ts: event.ts,
        });
        break;
    }
  }
}
