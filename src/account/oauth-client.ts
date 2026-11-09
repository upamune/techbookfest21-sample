import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "void/client";

export const oauthAuthClient = createAuthClient({ plugins: [oauthProviderClient()] });
