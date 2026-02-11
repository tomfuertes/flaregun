import type { AppLoadContext } from "@remix-run/cloudflare";
import type { AEConfig } from "./ae.server";

export function getAEConfig(context: AppLoadContext): AEConfig {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  return {
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_API_TOKEN,
    dataset: env.AE_DATASET || "flaregun_errors",
  };
}
