import { nanoid } from "nanoid";
import type { DB } from "../src/db";
import { event, user, type Event } from "../src/db/schema";

// Tests share one D1 database per file, so every row gets unique values
// instead of relying on cleanup.
export async function createTestUser(
  db: DB,
  overrides: Partial<typeof user.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? nanoid();
  await db.insert(user).values({
    id,
    name: "Test Organizer",
    email: `${id.toLowerCase()}@example.com`,
    ...overrides,
  });
  return { id };
}

export async function createTestEvent(
  db: DB,
  ownerId: string,
  overrides: Partial<typeof event.$inferInsert> = {},
): Promise<Event> {
  const id = overrides.id ?? nanoid();
  const [row] = await db
    .insert(event)
    .values({
      id,
      code: `evt-${id
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "x")
        .slice(0, 12)}`,
      title: "Test Event",
      description: "A test event description that is long enough to be valid.",
      organizer: "Test Organizer",
      date: "2026-01-15",
      ownerId,
      ...overrides,
    })
    .returning();
  return row;
}
