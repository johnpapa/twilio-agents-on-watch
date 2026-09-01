import { Component, signal } from '@angular/core';
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

  constructor(readonly agent: AgentService) {
    this.agent.checkHealth();
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

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour12: false });
  }
}
