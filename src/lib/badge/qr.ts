import { encode } from "uqr";

export function qrModules(text: string): boolean[][] {
  return encode(text, { ecc: "M", border: 0 }).data;
}
