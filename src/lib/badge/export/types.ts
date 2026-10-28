import type { HoloBadgeHandle } from "@/components/badge/holo-badge";

export type ExportOptions = {
  signal?: AbortSignal;
  /** 0 to 1 */
  onProgress?: (fraction: number) => void;
};

export type BadgeHandle = HoloBadgeHandle;
