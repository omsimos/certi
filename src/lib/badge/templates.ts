import { z } from "zod";

export const BADGE_TEMPLATES = ["graphite", "branded", "id"] as const;
export type BadgeTemplate = (typeof BADGE_TEMPLATES)[number];

// Numeric mode the badge shader switches on.
export const TEMPLATE_MODE: Record<BadgeTemplate, 0 | 1 | 2> = {
  graphite: 0,
  branded: 1,
  id: 2,
};

export const DEFAULT_ACCENT = "#6d3cff";

export const accentColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
