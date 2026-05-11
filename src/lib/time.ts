const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateWorkMinutes(params: {
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}): number {
  const { clockIn, clockOut, breakStart, breakEnd } = params;

  if (!clockIn || !clockOut) {
    return 0;
  }

  const total = toMinutes(clockOut) - toMinutes(clockIn);
  const breakMinutes =
    breakStart && breakEnd ? toMinutes(breakEnd) - toMinutes(breakStart) : 0;
  return Math.max(0, total - Math.max(0, breakMinutes));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
