import { describe, expect, it } from "vite-plus/test";
import configureAuth from "../../auth";

function options(env: Parameters<typeof configureAuth>[0]["env"]) {
  return configureAuth({
    defaults: { emailAndPassword: { enabled: true } },
    env,
    dialect: "sqlite",
    request: new Request("https://pocket.example"),
  });
}

describe("GitHub OAuth configuration", () => {
  it.each([
    {},
    { POCKET_AUTH_ENABLED: true },
    { POCKET_AUTH_ENABLED: true, AUTH_GITHUB_CLIENT_ID: "test-client" },
    { POCKET_AUTH_ENABLED: true, AUTH_GITHUB_CLIENT_SECRET: "test-fixture" },
    {
      POCKET_AUTH_ENABLED: true,
      AUTH_GITHUB_CLIENT_ID: " ",
      AUTH_GITHUB_CLIENT_SECRET: "test-fixture",
    },
    {
      POCKET_AUTH_ENABLED: false,
      AUTH_GITHUB_CLIENT_ID: "test-client",
      AUTH_GITHUB_CLIENT_SECRET: "test-fixture",
    },
  ])("fails closed without an enabled gate and both settings: %j", (env) => {
    expect(options(env).socialProviders).toEqual({});
    expect(options(env).emailAndPassword.enabled).toBe(false);
  });
  it.each([true, "true"])("enables GitHub only with complete configuration (%s)", (enabled) => {
    const configuration = options({
      POCKET_AUTH_ENABLED: enabled,
      AUTH_GITHUB_CLIENT_ID: "test-client",
      AUTH_GITHUB_CLIENT_SECRET: "test-fixture",
    });
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
