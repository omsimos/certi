export const DAY_MS = 86_400_000;

export type SendSlot = { at: Date; size: number };

// Every send or schedule within a day of a slot counts against it, which stays under
// the cap whether Resend counts a rolling 24h window or calendar days.
export function planSendSlots(i: {
  count: number;
  now: Date;
  dailyLimit: number;
  commitments: Date[];
  maxDays?: number;
}): { slots: SendSlot[]; overflow: number } {
  const maxDays = i.maxDays ?? 30;
  const slots: SendSlot[] = [];
  let remaining = i.count;

  for (let k = 0; k < maxDays && remaining > 0; k++) {
    const at = new Date(i.now.getTime() + k * DAY_MS);
    const near = (t: number) => Math.abs(t - at.getTime()) < DAY_MS;
    const used =
      i.commitments.filter((c) => near(c.getTime())).length +
      slots.reduce((n, s) => n + (near(s.at.getTime()) ? s.size : 0), 0);
    const size = Math.min(Math.max(0, i.dailyLimit - used), remaining);
    if (size === 0) continue;
    slots.push({ at: k === 0 ? i.now : at, size });
    remaining -= size;
  }

  return { slots, overflow: remaining };
}
