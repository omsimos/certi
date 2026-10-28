export const DAY_MS = 86_400_000;
// Slots sit a little more than a day apart, so a rolling 24h cap has fully reset by the
// next slot even if Resend's clock or send time drifts by a few minutes.
export const SLOT_MARGIN_MS = 15 * 60_000;
export const SLOT_STEP_MS = DAY_MS + SLOT_MARGIN_MS;

export type SendSlot = { at: Date; size: number };

// Every send or schedule within a slot step of a slot counts against it, which stays
// under the cap whether Resend counts a rolling 24h window or calendar days.
export function planSendSlots(i: {
  count: number;
  now: Date;
  dailyLimit: number;
  commitments: Date[];
  maxDays?: number;
}): { slots: SendSlot[]; overflow: number } {
  // Resend schedules at most this far ahead.
  const horizon = i.now.getTime() + (i.maxDays ?? 30) * DAY_MS;
  const slots: SendSlot[] = [];
  let remaining = i.count;

  for (let k = 0; remaining > 0; k++) {
    const at = new Date(i.now.getTime() + k * SLOT_STEP_MS);
    if (at.getTime() >= horizon) break;
    const near = (t: number) => Math.abs(t - at.getTime()) < SLOT_STEP_MS;
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
