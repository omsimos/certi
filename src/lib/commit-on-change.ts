type ChangeTarget = Pick<HTMLInputElement, "value" | "addEventListener" | "removeEventListener">;

// A callback ref rather than a mount effect: the input can mount long after its owner (and
// remount), and each element it lands on needs the listener. `change`, not `input`, so a
// color picker commits once it settles instead of on every drag.
export function commitOnChange<T extends ChangeTarget>(
  commit: (value: string) => void,
): (el: T | null) => (() => void) | undefined {
  return (el) => {
    if (!el) return;
    const handler = () => commit(el.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  };
}
