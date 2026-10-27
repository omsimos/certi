import { useCallback, useState } from "react";

// Resolves to whether the copy succeeded so callers can toast either outcome.
export function useCopyToClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch {
      // `navigator.clipboard` is missing on insecure origins and writeText rejects without permission.
      setCopiedText(null);
      return false;
    }
  }, []);

  return [copiedText, copy] as const;
}
