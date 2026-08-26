/* Ambient declarations for the globals this app still shares between modules.
   `config.js` sets FIREBASE_CONFIG from a plain <script> tag, and `sync.ts`
   publishes `Sync` on window so `app.ts` can talk to it without an import
   cycle — same wiring as before the TypeScript migration. */

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  sdkVersion?: string;
  [key: string]: unknown;
}

interface SyncState {
  ready: boolean;
  user: { uid: string; email: string | null } | null;
  status: string;
  msg: string;
  last: number | null;
  busy: boolean;
}

interface SyncApi {
  init(): Promise<void>;
  on(cb: (s: SyncState) => void): void;
  run(reason?: string): Promise<void>;
  schedule(ms?: number): void;
  signIn(email: string, pass: string): Promise<void>;
  signUp(email: string, pass: string): Promise<void>;
  signOut(): Promise<void>;
  reset(email: string): Promise<void>;
  signInGoogle(): Promise<void>;
  configured(): boolean;
  lastPull(): number | null;
  state: SyncState;
  _inject(backend: unknown, user: SyncState["user"]): void;
  _stamp(): void;
}

interface AppApi {
  getState(): any;
  adoptState(next: any): void;
  render(): void;
  toast(msg: string): void;
}

declare const Sync: SyncApi;
declare const App: AppApi;

interface Window {
  FIREBASE_CONFIG?: FirebaseConfig;
  Sync?: SyncApi;
  App?: AppApi;
  webkitAudioContext?: typeof AudioContext;
}
