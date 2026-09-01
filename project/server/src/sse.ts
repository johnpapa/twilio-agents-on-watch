import type { Response } from 'express';

/**
 * One SSE "channel" per demo run. The agent run and the Twilio inbound
 * poller both publish onto a run's channel; any number of browser tabs
 * can subscribe to watch the same run.
 */

export interface StepEvent {
  type: string;
  ts: number;
  [key: string]: unknown;
}

export interface StepEventInput {
  type: string;
  [key: string]: unknown;
}

class RunChannel {
  private subscribers = new Set<Response>();
  private buffer: StepEvent[] = [];
  private readonly maxBuffer = 500;

  subscribe(res: Response) {
    this.subscribers.add(res);
    // Replay everything so far so a late-attaching browser catches up.
    for (const event of this.buffer) {
      writeEvent(res, event);
    }
  }

  unsubscribe(res: Response) {
    this.subscribers.delete(res);
  }

  publish(event: StepEventInput) {
    const full: StepEvent = { ...event, ts: Date.now() };
    this.buffer.push(full);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    for (const res of this.subscribers) writeEvent(res, full);
  }
}

function writeEvent(res: Response, event: StepEvent) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const channels = new Map<string, RunChannel>();

export function getChannel(runId: string): RunChannel {
  let channel = channels.get(runId);
  if (!channel) {
    channel = new RunChannel();
    channels.set(runId, channel);
  }
  return channel;
}

export function publish(runId: string, event: StepEventInput) {
  getChannel(runId).publish(event);
}
