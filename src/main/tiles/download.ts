import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { MAX_DOWNLOAD_BYTES } from "../security";

export interface DownloadProgress {
  done: number;
  total: number;
}

export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!/^https:\/\//i.test(url)) throw new Error("Дозволено лише https-адреси");
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`Не вдалося завантажити ${url}: ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (total > MAX_DOWNLOAD_BYTES) throw new Error("Файл завеликий");

  await mkdir(dirname(destPath), { recursive: true });
  const out = createWriteStream(destPath);

  let done = 0;
  const reader = res.body.getReader();
  const stream = new Readable({
    async read() {
      const { value, done: end } = await reader.read();
      if (end) {
        this.push(null);
        return;
      }
      done += value.byteLength;
      if (done > MAX_DOWNLOAD_BYTES) {
        this.destroy(new Error("Файл завеликий"));
        return;
      }
      onProgress?.({ done, total });
      this.push(Buffer.from(value));
    }
  });

  stream.pipe(out);
  await finished(out);
}
