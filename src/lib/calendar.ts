export function parseDurationMinutes(duration: string): number {
  const hoursMatch = duration.match(/(\d+(?:\.\d+)?)\s*hour/i);
  const minutesMatch = duration.match(/(\d+)\s*min/i);
  let total = 0;
  if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
  if (minutesMatch) total += parseInt(minutesMatch[1], 10);
  return total > 0 ? total : 60;
}

export function buildActivityDateRange(
  date: string,
  time: string,
  durationMinutes: number
): { start: Date; end: Date } {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

function formatGCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function googleCalendarUrl(
  title: string,
  description: string,
  location: string,
  start: Date,
  end: Date
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
    details: description ?? "",
    location: location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
