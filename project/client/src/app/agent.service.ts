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
  'applied',
  'text',
  'error',
  'done',
  'closing-question',
  'closing-answer',
] as const;

let nextId = 1;

@Injectable({ providedIn: 'root' })
export class AgentService {
  readonly status = signal<RunStatus>('idle');
  readonly mock = signal(false);
  readonly steps = signal<StepRow[]>([]);
  readonly transcript = signal<TranscriptItem[]>([]);
  readonly waitingElapsed = signal<number | null>(null);
  readonly prUrl = signal<string | null>(null);
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
    this.prUrl.set(null);
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
        this.pushStep({ kind: 'call', message: `Prompt received: "${event['prompt']}"`, ts: event.ts });
        break;

      case 'tool-call':
        this.pushStep({
          tool: String(event['tool']),
          kind: 'call',
          message: `${event['tool']}(${JSON.stringify(event['args'])})`,
          ts: event.ts,
        });
        break;

      case 'tool-result':
        this.pushStep({
          tool: String(event['tool']),
          kind: 'result',
          message: `${event['tool']} → ${JSON.stringify(event['result'])}`,
          ts: event.ts,
        });
        break;

      case 'step':
        this.pushStep({
          tool: String(event['tool']),
          kind: event['severity'] === 'irreversible' ? 'escalation' : 'step',
          message: String(event['message']),
          ts: event.ts,
        });
        break;

      case 'message-sent':
        this.status.set('waiting');
        this.pushTranscript({ kind: 'outbound', body: String(event['body']), ts: event.ts });
        this.pushStep({ tool: 'askHuman', kind: 'escalation', message: `WhatsApp message sent to ${event['to']}`, ts: event.ts });
        break;

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
        this.pushStep({ tool: 'askHuman', kind: 'escalation', message: `Calling ${event['to']}…`, ts: event.ts });
        break;

      case 'reply':
        this.status.set('running');
        this.waitingElapsed.set(null);
        this.pushTranscript({ kind: 'inbound', text: String(event['text']), via: String(event['via']), ts: event.ts });
        this.pushStep({ tool: 'askHuman', kind: 'result', message: `Human replied: "${event['text']}"`, ts: event.ts });
        break;

      case 'applied':
        this.prUrl.set((event['prUrl'] as string | null) ?? null);
        break;

      case 'text':
        if (event['delta']) {
          this.pushStep({ kind: 'text', message: String(event['delta']), ts: event.ts });
        }
        break;

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
