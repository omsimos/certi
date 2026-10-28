export type EmailConfig = {
  mode: "log" | "resend";
  apiKey?: string;
  from: string;
  dailyLimit: number;
};

export function readEmailConfig(env: {
  EMAIL_MODE?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_DAILY_LIMIT?: string;
}): EmailConfig {
  const mode = env.EMAIL_MODE;
  if (mode !== "log" && mode !== "resend") throw new Error("EMAIL_MODE must be log or resend");

  const rawLimit = env.RESEND_DAILY_LIMIT ?? "100";
  if (!/^\d+$/.test(rawLimit)) {
    throw new Error("RESEND_DAILY_LIMIT must be a non-negative integer");
  }
  const dailyLimit = Number(rawLimit);

  if (mode === "log") {
    return {
      mode,
      apiKey: env.RESEND_API_KEY || undefined,
      from: env.RESEND_FROM || "certi <badges@localhost>",
      dailyLimit,
    };
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  if (!env.RESEND_FROM) throw new Error("RESEND_FROM is not set");
  return { mode, apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM, dailyLimit };
}
