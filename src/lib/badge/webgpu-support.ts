import { createHoloRenderer } from "@/components/badge/holo-renderer";

// Creating a renderer is the only check that also catches adapters that exist but fail.
export async function probeWebGPU(): Promise<boolean> {
  try {
    (await createHoloRenderer(new OffscreenCanvas(1, 1))).dispose();
    return true;
  } catch {
    return false;
  }
}
