/* =========================================================
   client.ts — One simulated device.
   sync.ts reads the device it runs on through two globals:
   localStorage (shadow + last pull marker) and App (the live
   state). Giving each client its own pair, and swapping them
   in before every call, is enough to run two real devices
   against one shared fake cloud inside a single test process.
   ========================================================= */

export class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

export interface AppState {
  settings: Record<string, unknown>;
  exercises: any[];
  routines: any[];
  sessions: any[];
  bw: any[];
  active?: unknown;
}

export function emptyState(): AppState {
  return {
    settings: { rest: 90 },
    exercises: [],
    routines: [],
    sessions: [],
    bw: [],
    active: null,
  };
}

export class Client {
  readonly storage = new FakeStorage();
  state: AppState;
  /** How many times sync handed this device a reconciled state. */
  adopted = 0;

  constructor(state: AppState = emptyState()) {
    this.state = state;
  }

  /** Point the globals sync.ts reads at this device. */
  activate(): void {
    Object.defineProperty(globalThis, "localStorage", {
      value: this.storage,
      configurable: true,
      writable: true,
    });
    (globalThis as any).App = {
      getState: () => this.state,
      adoptState: (next: AppState) => {
        this.state = next;
        this.adopted++;
      },
      render() {},
      toast() {},
    };
  }

  /** Mutate local state the way the app does, then mark it dirty like save() would. */
  edit(fn: (s: AppState) => void, sync: { _stamp(): void }): void {
    this.activate();
    fn(this.state);
    sync._stamp();
  }

  routine(id: string): any {
    return this.state.routines.find((r) => r.id === id);
  }
  session(id: string): any {
    return this.state.sessions.find((s) => s.id === id);
  }
  shadow(): Record<string, any> {
    return JSON.parse(this.storage.getItem("bitacora_shadow_v2") || "{}");
  }
  lastPull(): number {
    return Number(this.storage.getItem("bitacora_lastpull") || 0);
  }
}
