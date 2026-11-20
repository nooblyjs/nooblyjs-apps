// The live channel behind /api/v1/events (stack.md §4.2). Producers publish to a workspace (or to operators); each
// SSE connection listens to the workspaces its person belongs to. Phase 2 starts publishing deploy events here.
import { EventEmitter } from 'node:events';

export const OPERATORS = '__operators__';

export function createRealtime() {
  const bus = new EventEmitter().setMaxListeners(0);
  return {
    /** @param {string} topic  a workspace id, or OPERATORS */
    publish(topic, type, data = {}) {
      bus.emit(topic, { type, data, at: new Date().toISOString() });
    },
    /** @returns {() => void} unsubscribe */
    subscribe(topics, fn) {
      for (const t of topics) bus.on(t, fn);
      return () => { for (const t of topics) bus.off(t, fn); };
    },
  };
}
