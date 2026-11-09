import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "void/client";

export const oauthAuthClient = createAuthClient({ plugins: [oauthProviderClient()] });

export function hostOf(value: string) {
  return URL.canParse(value) ? new URL(value).host : null;
}

export function clientPublisher(clientId: string) {
  return clientId.startsWith("https://") ? hostOf(clientId) : null;
}
