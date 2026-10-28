declare module "gifenc" {
  export type Palette = number[][];
  export function quantize(rgba: Uint8ClampedArray, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8ClampedArray, palette: Palette): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: Palette; delay: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
