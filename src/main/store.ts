import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FILE_NAME = "board.json";

function storePath(): string {
  return join(app.getPath("userData"), FILE_NAME);
}

export async function loadStore(): Promise<unknown> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveStore(data: unknown): Promise<void> {
  const dir = app.getPath("userData");
  await mkdir(dir, { recursive: true });
  const path = storePath();
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data), "utf8");
  await rename(tmp, path);
}
