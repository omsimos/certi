import { describe, expect, it } from "vitest";
import { DAY_MS, planSendSlots, SLOT_MARGIN_MS, SLOT_STEP_MS } from "../src/server/email/slots";

const now = new Date("2026-10-28T09:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);
const slot = (k: number) => at(k * SLOT_STEP_MS);
const repeat = (n: number, d: Date) => Array.from({ length: n }, () => d);

describe("planSendSlots", () => {
  it("fills today first, then one slot per following day", () => {
    const plan = planSendSlots({ count: 250, now, dailyLimit: 100, commitments: [] });
    expect(plan.slots).toEqual([
      { at: now, size: 100 },
      { at: slot(1), size: 100 },
      { at: slot(2), size: 50 },
    ]);
    expect(plan.overflow).toBe(0);
    expect(plan.slots[0].at).toBe(now);
  });

  it("counts sends from the last 24h against today only, with a margin before the next slot", () => {
    const plan = planSendSlots({
      count: 250,
      now,
      dailyLimit: 100,
      commitments: repeat(60, at(-2 * 3_600_000)),
    });
    expect(plan.slots[0]).toEqual({ at: now, size: 40 });
    expect(plan.slots[1].size).toBe(100);
    expect(plan.slots[1].at.getTime()).toBeGreaterThanOrEqual(
      now.getTime() + DAY_MS + SLOT_MARGIN_MS,
    );
  });

  it("counts another event's schedule against the matching slot", () => {
    const plan = planSendSlots({
      count: 250,
      now,
      dailyLimit: 100,
      commitments: repeat(30, slot(1)),
    });
    expect(plan.slots.map((s) => s.size)).toEqual([100, 70, 80]);
    expect(plan.slots[1].at).toEqual(slot(1));
  });

  it("counts a schedule exactly a day ahead against today too", () => {
    const plan = planSendSlots({
      count: 100,
      now,
      dailyLimit: 100,
      commitments: repeat(30, at(DAY_MS)),
    });
    expect(plan.slots[0]).toEqual({ at: now, size: 70 });
  });

  it("skips a full day instead of emitting an empty slot", () => {
    const plan = planSendSlots({ count: 5, now, dailyLimit: 2, commitments: repeat(2, now) });
    expect(plan.slots).toEqual([
      { at: slot(1), size: 2 },
      { at: slot(2), size: 2 },
      { at: slot(3), size: 1 },
    ]);
  });

  it("stops before 30 days and reports the rest as overflow", () => {
    const plan = planSendSlots({ count: 3001, now, dailyLimit: 100, commitments: [] });
    expect(plan.slots).toHaveLength(30);
    expect(plan.overflow).toBe(1);
    expect(plan.slots.at(-1)!.at.getTime()).toBeLessThan(at(30 * DAY_MS).getTime());
    for (let k = 1; k < plan.slots.length; k++) {
      const gap = plan.slots[k].at.getTime() - plan.slots[k - 1].at.getTime();
      expect(gap).toBe(SLOT_STEP_MS);
    }
  });

  it("plans nothing when the daily limit is 0", () => {
    const plan = planSendSlots({ count: 7, now, dailyLimit: 0, commitments: [] });
    expect(plan).toEqual({ slots: [], overflow: 7 });
  });

  it("plans nothing for an empty send", () => {
    expect(planSendSlots({ count: 0, now, dailyLimit: 100, commitments: [] })).toEqual({
      slots: [],
      overflow: 0,
    });
  });
});
