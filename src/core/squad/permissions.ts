/**
 * Матриця прав режиму відділення (docs/squad-mode.md, розділ 4). Сервер перевіряє кожну дію тут;
 * клієнт використовує ті самі функції лише для того, щоб приховати недоступне.
 */
import type { Affiliation } from "../marks";
import type { Role, SquadKind } from "./protocol";

export interface MarkRef {
  aff: Affiliation;
  kind: SquadKind;
  /** Чи мітку створив той, хто діє. */
  own: boolean;
}

const staff = (role: Role): boolean => role !== "soldier";

/** Створити мітку (або перетворити на такий вид): свій міномет — лише командир і мінометники. */
export function canCreate(role: Role, aff: Affiliation, kind: SquadKind): boolean {
  if (aff === "friend" && kind === "mortar") return staff(role);
  return true;
}

/** Пересунути мітку: усі, включно з мінометом (рішення D6). */
export function canMove(_role: Role): boolean {
  return true;
}

/** Змінити вид, приналежність або назву: чужу — лише командир і мінометники, свою — будь-хто. */
export function canEdit(role: Role, m: MarkRef): boolean {
  return m.own || staff(role);
}

export function canDelete(role: Role, m: MarkRef): boolean {
  return m.own || staff(role);
}

/** Підпис: командир і мінометники — до будь-якої; солдат — до своїх і до чужих (ворожих) міток. */
export function canCaption(role: Role, m: MarkRef): boolean {
  return staff(role) || m.own || m.aff === "hostile";
}

/** Позначити зруйнованим або відновити: усі. */
export function canSetStatus(_role: Role): boolean {
  return true;
}

/** Розрахунок, журнал стрільби та попередження про своїх. */
export function canUseSolution(role: Role): boolean {
  return staff(role);
}

export function canAdmin(role: Role): boolean {
  return role === "commander";
}

/** Редагувати звіт після завершення гри: командир завжди, інші — лише з дозволом. */
export function canEditReport(role: Role, editor: boolean): boolean {
  return role === "commander" || editor;
}
