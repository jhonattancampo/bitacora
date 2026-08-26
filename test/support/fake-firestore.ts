/* =========================================================
   fake-firestore.ts — In-memory stand-in for the slice of the
   Firestore SDK that sync.ts actually uses.
   It exists so the reconciliation logic can be driven end to
   end (two devices, one server) without a network or a project.
   ========================================================= */

export interface DocBody {
  type?: string;
  data?: unknown;
  deleted?: boolean;
  updatedAt?: number;
}

export interface FakeServerOptions {
  /** Make the next read look like it came from IndexedDB, not the network. */
  fromCache?: boolean;
  /** Return a promise that never settles, the way a wedged SDK read does. */
  hangGetDocs?: boolean;
  /** Same, for the "did the server acknowledge my writes?" call. */
  hangPendingWrites?: boolean;
}

export class FakeServer {
  /** docId -> stored body. This is the shared cloud both clients talk to. */
  readonly docs = new Map<string, DocBody>();
  readonly options: FakeServerOptions = {};
  /** Every getDocs() the clients made, for assertions about incremental reads. */
  readonly reads: Array<{ since: number | null }> = [];
  /** Every document written, in order. */
  readonly writes: string[] = [];

  snapshotOf(since: number | null): DocBody[] & { ids: string[] } {
    const ids: string[] = [];
    const out: DocBody[] = [];
    for (const [id, body] of this.docs) {
      if (since != null && !((body.updatedAt || 0) > since)) continue;
      ids.push(id);
      out.push(body);
    }
    return Object.assign(out, { ids });
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Builds the `{ db, m: { fs } }` shape that Sync._inject() expects. */
export function fakeBackend(server: FakeServer) {
  const db = { __fake: true };

  const fs = {
    collection: (_db: unknown, ...path: string[]) => ({ __col: path.join("/") }),

    doc: (col: { __col: string }, id: string) => ({ __col: col.__col, id }),

    where: (field: string, op: string, value: number) => ({ field, op, value }),

    query: (col: { __col: string }, ...constraints: Array<{ value: number }>) => ({
      __col: col.__col,
      since: constraints.length ? constraints[0].value : null,
    }),

    getDocs: (target: { since?: number | null }) => {
      const since = target.since ?? null;
      server.reads.push({ since });
      if (server.options.hangGetDocs) return new Promise(() => {});
      const bodies = server.snapshotOf(since);
      const ids = bodies.ids;
      return Promise.resolve({
        metadata: { fromCache: !!server.options.fromCache },
        forEach(cb: (d: { id: string; data: () => DocBody }) => void) {
          ids.forEach((id, i) => cb({ id, data: () => clone(bodies[i]) }));
        },
      });
    },

    writeBatch: () => {
      const ops: Array<[string, DocBody]> = [];
      return {
        set(ref: { id: string }, body: DocBody) {
          ops.push([ref.id, clone(body)]);
        },
        commit: () => {
          ops.forEach(([id, body]) => {
            server.docs.set(id, body);
            server.writes.push(id);
          });
          return Promise.resolve();
        },
      };
    },

    waitForPendingWrites: () => {
      if (server.options.hangPendingWrites) return new Promise(() => {});
      return Promise.resolve();
    },
  };

  return { db, m: { fs }, app: null, auth: null };
}
