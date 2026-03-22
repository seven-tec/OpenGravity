import type { FirestoreService } from './database/firestore.js';

export interface AgentEvent {
  timestamp: string;
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer' | 'error';
  userId: string;
  content: any;
}

export class ObservabilityService {
  private events: AgentEvent[] = [];
  private firestore?: FirestoreService;
  private readonly maxEvents = 100;

  constructor(firestore?: FirestoreService) {
    this.firestore = firestore;
  }

  public emit(userId: string, type: AgentEvent['type'], content: any, traceId?: string): void {
    const event: AgentEvent = {
      timestamp: new Date().toISOString(),
      type,
      userId,
      content
    };

    // Buffer for real-time HUD
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Console logging (Architecture level)
    console.log(`[Obs] [${type.toUpperCase()}] ${userId}: ${typeof content === 'string' ? content.substring(0, 100) : 'Object'}`);

    // Persistence for traces
    if (traceId && this.firestore?.initialized) {
      this.firestore.saveTrace(userId, traceId, event).catch((err) => {
        console.warn(`[Obs] Failed to save trace to Firestore: ${err.message}`);
      });
    }
  }

  public getEvents(): AgentEvent[] {
    return [...this.events];
  }

  public clearEvents(): void {
    this.events = [];
  }
}
