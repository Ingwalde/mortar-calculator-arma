/**
 * Рушій синхронізації міток на клієнті (docs/squad-mode.md, розділ 8): працює без DOM і без мережі, тож перевіряється тестами.
 *
 * Модель: застосунок змінює свої мітки як завжди (діалог, список), а рушій порівнює їх із «дзеркалом» — тим, що матиме сервер,
 * коли прийме всі надіслані й ще не підтверджені дії, — і складає з різниці дії для черги. Черга переживає розрив зв'язку
 * (і перезапуск, якщо зберегти `toJSON`), а після повернення зв'язку дії надсилаються з тими самими `opId`, тож повтор безпечний.
 */
import type { MarkOp, ServerMsg, SquadMark } from "./protocol";

export interface Pending {
  opId: string;
  op: MarkOp;
}

/** Бажаний стан мітки, як його бачить застосунок (без авторства й часу — їх веде сервер). */
export type Wanted = Pick<SquadMark, "id" | "aff" | "kind" | "name" | "caption" | "x" | "z" | "u" | "w" | "destroyed">;

export type Change = { id: string; mark: SquadMark | null };

export interface SyncDump {
  me: string;
  mirror: SquadMark[];
  queue: Pending[];
}

/** Застосовує дію до мітки (undefined — мітки ще нема). Повертає нову мітку або null, якщо мітку видалено. */
export function applyOp(cur: SquadMark | undefined, op: MarkOp, by: string, at: number): SquadMark | null {
  if (op.k === "create") {
    return { id: op.id, aff: op.aff, kind: op.kind, name: op.name, caption: op.caption, x: op.x, z: op.z, u: op.u, w: op.w, destroyed: false, by, at, ub: by, ut: at };
  }
  if (!cur) return null;
  const m: SquadMark = { ...cur, ub: by, ut: at };
  switch (op.k) {
    case "edit":
      if (op.aff !== undefined) m.aff = op.aff;
      if (op.kind !== undefined) m.kind = op.kind;
      if (op.name !== undefined) m.name = op.name;
      if (op.w !== undefined) m.w = op.w;
      return m;
    case "move":
      m.x = op.x;
      m.z = op.z;
      m.u = op.u;
      return m;
    case "caption":
      m.caption = op.caption;
      return m;
    case "status":
      m.destroyed = op.destroyed;
      return m;
    case "delete":
      return null;
  }
}

export function newOpId(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class SquadSync {
  private mirror = new Map<string, SquadMark>();
  private queue: Pending[] = [];
  private now: () => number;

  constructor(
    private me: string,
    opts: { now?: () => number; dump?: SyncDump } = {}
  ) {
    this.now = opts.now ?? Date.now;
    if (opts.dump && opts.dump.me === me) {
      for (const m of opts.dump.mirror) this.mirror.set(m.id, m);
      this.queue = opts.dump.queue.slice();
    }
  }

  toJSON(): SyncDump {
    return { me: this.me, mirror: [...this.mirror.values()], queue: this.queue.slice() };
  }

  get pending(): readonly Pending[] {
    return this.queue;
  }

  marks(): SquadMark[] {
    return [...this.mirror.values()];
  }

  get(id: string): SquadMark | undefined {
    return this.mirror.get(id);
  }

  /** Порівнює бажаний стан із дзеркалом, складає дії в чергу й повертає нові. */
  diff(wanted: Iterable<Wanted>): Pending[] {
    const out: Pending[] = [];
    const seen = new Set<string>();
    const push = (op: MarkOp): void => {
      const p = { opId: newOpId(), op };
      out.push(p);
      const next = applyOp(this.mirror.get(op.id), op, this.me, this.now());
      if (next) this.mirror.set(op.id, next);
      else this.mirror.delete(op.id);
    };
    for (const w of wanted) {
      seen.add(w.id);
      const cur = this.mirror.get(w.id);
      if (!cur) {
        push({ k: "create", id: w.id, aff: w.aff, kind: w.kind, x: w.x, z: w.z, name: w.name, caption: w.caption, u: w.u, w: w.w });
        if (w.destroyed) push({ k: "status", id: w.id, destroyed: true });
        continue;
      }
      const edit: Extract<MarkOp, { k: "edit" }> = { k: "edit", id: w.id };
      if (w.aff !== cur.aff) edit.aff = w.aff;
      if (w.kind !== cur.kind) edit.kind = w.kind;
      if (w.name !== cur.name) edit.name = w.name;
      if (w.w !== cur.w) edit.w = w.w;
      if (edit.aff !== undefined || edit.kind !== undefined || edit.name !== undefined || edit.w !== undefined) push(edit);
      if (w.x !== cur.x || w.z !== cur.z || w.u !== cur.u) push({ k: "move", id: w.id, x: w.x, z: w.z, u: w.u });
      if (w.caption !== cur.caption) push({ k: "caption", id: w.id, caption: w.caption });
      if (w.destroyed !== cur.destroyed) push({ k: "status", id: w.id, destroyed: w.destroyed });
    }
    for (const id of [...this.mirror.keys()]) {
      if (!seen.has(id)) push({ k: "delete", id });
    }
    this.queue.push(...out);
    return out;
  }

  /**
   * Дія від сервера. Своя дія (її `opId` є в черзі) лише підтверджується; чужа змінює дзеркало з урахуванням наших ще не
   * підтверджених дій над тією самою міткою. Повертає зміну для застосунку або null, якщо застосунку нічого міняти.
   */
  onOp(msg: Extract<ServerMsg, { t: "op" }>): Change | null {
    const idx = this.queue.findIndex((p) => p.opId === msg.opId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return null;
    }
    const id = msg.op.id;
    let next: SquadMark | null = msg.mark;
    // чужа дія стоїть у порядку сервера раніше за наші ще не прийняті: накладаємо їх зверху
    for (const p of this.queue) if (p.op.id === id) next = applyOp(next ?? undefined, p.op, this.me, this.now());
    if (next) this.mirror.set(id, next);
    else this.mirror.delete(id);
    return { id, mark: next };
  }

  /** Підтвердження дубля: дію прийнято раніше. */
  onAck(opId: string): void {
    const idx = this.queue.findIndex((p) => p.opId === opId);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  /** Дію відхилено: прибираємо її з черги. Дзеркало тепер може розходитись із сервером, тож потрібен свіжий зліпок. */
  onReject(opId: string): void {
    const idx = this.queue.findIndex((p) => p.opId === opId);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  /** Свіжий зліпок: дзеркало береться з нього, а наші ще не підтверджені дії накладаються зверху. Повертає підсумкові мітки. */
  onSnapshot(marks: SquadMark[]): SquadMark[] {
    this.mirror = new Map(marks.map((m) => [m.id, m]));
    const keep: Pending[] = [];
    for (const p of this.queue) {
      const cur = this.mirror.get(p.op.id);
      // дія над міткою, якої на сервері нема (і яку ця дія не створює), вже безглузда
      if (!cur && p.op.k !== "create") continue;
      const next = applyOp(cur, p.op, this.me, this.now());
      if (next) this.mirror.set(p.op.id, next);
      else this.mirror.delete(p.op.id);
      keep.push(p);
    }
    this.queue = keep;
    return this.marks();
  }
}
