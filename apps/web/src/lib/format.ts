const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "3時間前" "昨日 20:14" "3日前" のような相対表示 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const diff = now.getTime() - t;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / 60000))}分前`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}時間前`;
  if (diff < 2 * DAY) return `昨日 ${hhmm(iso)}`;
  return `${Math.round(diff / DAY)}日前`;
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function untilLabel(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return '期限切れ';
  if (diff < DAY) return `残り約${Math.round(diff / HOUR)}時間`;
  return `残り約${Math.round(diff / DAY)}日`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm(iso)}`;
}
