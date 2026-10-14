/** Порівняння версій і вибір файлу оновлення з релізу GitHub (для APK і веб-версії). */

export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** true, якщо latest строго новіша за current; нерозпізнані версії — false. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export interface ReleaseLike {
  tag_name: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; browser_download_url: string }[];
}

/** Пряме посилання на APK із релізу; null — файлу ще нема. */
export function apkUrlOf(rel: ReleaseLike): string | null {
  const asset = rel.assets?.find((a) => /\.apk$/i.test(a.name));
  return asset ? asset.browser_download_url : null;
}

/** Реліз, про який варто повідомити: стабільний, не чернетка, новіший за поточну версію. */
export function updateFrom(rel: ReleaseLike | null, current: string): { version: string; url: string } | null {
  if (!rel || rel.draft || rel.prerelease) return null;
  if (!isNewerVersion(rel.tag_name, current)) return null;
  const url = apkUrlOf(rel) ?? rel.html_url ?? null;
  return url ? { version: rel.tag_name.replace(/^v/, ""), url } : null;
}
