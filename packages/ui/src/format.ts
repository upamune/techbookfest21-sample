const relativeTime = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });

const units = [
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
] as const;

export function formatRelativeTime(isoDate: string, now = Date.now()) {
  const elapsed = Math.round((Date.parse(isoDate) - now) / 1000);
  for (const { unit, seconds } of units) {
    if (Math.abs(elapsed) >= seconds)
      return relativeTime.format(Math.trunc(elapsed / seconds), unit);
  }
  return "たった今";
}
