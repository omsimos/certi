// Workers never set NODE_ENV=production, so Better Auth's own guard against its
// public default secret never fires. Fail closed ourselves outside dev.
export function requireEnv(
  name: string,
  value: string | undefined,
  isDev: boolean,
): string | undefined {
  if (value) return value;
  if (!isDev) throw new Error(`${name} is not set`);
  return undefined;
}
