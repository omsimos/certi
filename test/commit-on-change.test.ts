import { describe, expect, it } from "vitest";
import { commitOnChange } from "../src/lib/commit-on-change";

const input = (value: string) => Object.assign(new EventTarget(), { value });

describe("commitOnChange", () => {
  it("commits on change but not on input", () => {
    const seen: string[] = [];
    const el = input("#111111");
    commitOnChange((v) => seen.push(v))(el);

    el.value = "#222222";
    el.dispatchEvent(new Event("input"));
    expect(seen).toEqual([]);
    el.dispatchEvent(new Event("change"));
    expect(seen).toEqual(["#222222"]);
  });

  it("follows an input that mounts late, unmounts and mounts again", () => {
    const seen: string[] = [];
    const ref = commitOnChange((v) => seen.push(v));
    expect(ref(null)).toBeUndefined();

    const first = input("#aaaaaa");
    const detach = ref(first);
    first.dispatchEvent(new Event("change"));
    detach!();
    first.dispatchEvent(new Event("change"));

    const second = input("#bbbbbb");
    ref(second);
    second.dispatchEvent(new Event("change"));
    expect(seen).toEqual(["#aaaaaa", "#bbbbbb"]);
  });
});
