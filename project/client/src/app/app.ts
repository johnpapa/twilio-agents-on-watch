import { Component, ElementRef, afterRenderEffect, signal, viewChild } from '@angular/core';
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
    'Send the outage notice to everyone affected by the incident.',
  );

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly stepsList = viewChild<ElementRef<HTMLElement>>('stepsList');

  constructor(readonly agent: AgentService) {
    this.agent.checkHealth();

    // Both panes have to follow the conversation on their own. On stage there
    // is no free hand to scroll with, and the newest message is the only one
    // that matters -- without this the call marker arrives below the fold.
    //
    // afterRenderEffect, not effect: the row that triggered the scroll has to
    // exist in the layout before scrollHeight is worth reading. Pinning any
    // earlier lands one row short, every time, and the row it cuts off is
    // always the newest one.
    afterRenderEffect(() => {
      this.agent.transcript();
      this.agent.waitingElapsed();
      this.paneHeightChanged();
      pinToBottom(this.thread());
    });

    afterRenderEffect(() => {
      this.agent.steps();
      this.paneHeightChanged();
      pinToBottom(this.stepsList());
    });
  }

  /**
   * Read the signals that make the panes shorter. The result is thrown away --
   * the point is the dependency. When the outcome banner appears it takes a
   * row's worth of height off both panes, and a pane already scrolled to the
   * bottom silently ends up one row short of it. That row is the answer the
   * whole demo was waiting for.
   */
  private paneHeightChanged(): void {
    this.agent.outcome();
    this.agent.errorMessage();
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

function pinToBottom(ref: ElementRef<HTMLElement> | undefined): void {
  const el = ref?.nativeElement;
  if (el) el.scrollTop = el.scrollHeight;
}
