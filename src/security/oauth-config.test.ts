import { describe, expect, it } from "vite-plus/test";
import configureAuth from "../../auth";
import { isAuthConfigured } from "./auth-config";

function options(env: Parameters<typeof configureAuth>[0]["env"]) {
  return configureAuth({
    defaults: { emailAndPassword: { enabled: true } },
    env,
    dialect: "sqlite",
    request: new Request("https://pocket.example"),
  });
}

describe("GitHub OAuth configuration", () => {
  const complete = {
    AUTH_GITHUB_CLIENT_ID: "test-client",
    AUTH_GITHUB_CLIENT_SECRET: "test-fixture",
    POCKET_ALLOWED_GITHUB_IDS: '["1"]',
  };
  it.each([
    {},
    { ...complete, AUTH_GITHUB_CLIENT_ID: undefined },
    { ...complete, AUTH_GITHUB_CLIENT_SECRET: undefined },
    { ...complete, AUTH_GITHUB_CLIENT_ID: " " },
    { ...complete, POCKET_ALLOWED_GITHUB_IDS: undefined },
    { ...complete, POCKET_ALLOWED_GITHUB_IDS: "[]" },
    { ...complete, POCKET_ALLOWED_GITHUB_IDS: "not json" },
  ])("fails closed without credentials and an allowlist: %j", (env) => {
    expect(options(env).socialProviders).toEqual({});
    expect(options(env).emailAndPassword.enabled).toBe(false);
    expect(isAuthConfigured(env)).toBe(false);
  });
  it("enables GitHub once credentials and an allowlist are set", () => {
    expect(isAuthConfigured(complete)).toBe(true);
    const configuration = options(complete);
    expect(configuration.socialProviders).toEqual({
      github: {
        clientId: "test-client",
        clientSecret: "test-fixture",
        mapProfileToUser: expect.any(Function),
      },
    });
    expect(configuration.emailAndPassword.enabled).toBe(false);
  });
});
