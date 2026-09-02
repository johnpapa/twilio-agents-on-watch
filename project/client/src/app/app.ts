import { Component, ElementRef, effect, signal, viewChild } from '@angular/core';
import { AgentService } from './agent.service';
import type { RunStatus } from './models';

const STATUS_LABELS: Record<RunStatus, string> = {
  idle: 'Idle',
  running: 'Working…',
  waiting: 'Waiting for reply',
  calling: 'Escalating to voice',
  done: 'Done',
  error: 'Error',
};

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly prompt = signal(
    'Clean up the unused columns in the users table and open a PR.',
  );

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly stepsList = viewChild<ElementRef<HTMLElement>>('stepsList');

  constructor(readonly agent: AgentService) {
    this.agent.checkHealth();

    // Both panes have to follow the conversation on their own. On stage there
    // is no free hand to scroll with, and the newest message is the only one
    // that matters -- without this the call marker arrives below the fold.
    effect(() => {
      this.agent.transcript();
      this.agent.waitingElapsed();
      queueMicrotask(() => this.pinToBottom(this.thread()));
    });

    effect(() => {
      this.agent.steps();
      queueMicrotask(() => this.pinToBottom(this.stepsList()));
    });
  }

  private pinToBottom(ref: ElementRef<HTMLElement> | undefined): void {
    const el = ref?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  runDemo(): void {
    const value = this.prompt().trim();
    if (!value || this.agent.isBusy()) return;
    void this.agent.run(value);
  }

  onPromptInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.prompt.set(target.value);
  }

  statusLabel(): string {
    return STATUS_LABELS[this.agent.status()];
  }

  /** Wall clock to the second, for the activity feed. */
  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour12: false });
  }

  /** Hours and minutes only -- what a message bubble shows on a real phone. */
  formatClock(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
