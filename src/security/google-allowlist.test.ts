import { describe, expect, it } from "vite-plus/test";
import configureAuth from "../../auth";
import {
  authorizeGoogleProfile,
  isAllowedGoogleSub,
  parseAllowedGoogleSubs,
} from "./google-allowlist";

function options(env: Parameters<typeof configureAuth>[0]["env"]) {
  return configureAuth({
    defaults: {},
    env,
    dialect: "sqlite",
    request: new Request("https://tasks.example"),
  });
}

describe("Google immutable subject allowlist", () => {
  it.each([undefined, "", "[]", "invalid", "[42]", '[""]', '["42", " "]'])(
    "denies absent or invalid allowlist %s",
    (allowlist) => {
      expect(parseAllowedGoogleSubs(allowlist).size).toBe(0);
      expect(() => authorizeGoogleProfile({ allowlist, profile: { sub: "42" } })).toThrow(
        "not permitted",
      );
    },
  );
  it.each([42, null, undefined, "42 ", " 42", "abc", "42\n"])("never coerces subject %s", (sub) => {
    expect(isAllowedGoogleSub({ allowlist: '["42", "AbC"]', sub })).toBe(false);
  });
  it("matches exact case-sensitive string and ignores email and name", () => {
    expect(
      authorizeGoogleProfile({
        allowlist: '["AbC"]',
        profile: { sub: "AbC", email: "new@example.test" },
      }),
    ).toEqual({});
    expect(() =>
      authorizeGoogleProfile({
        allowlist: '["AbC"]',
        profile: { sub: "other", email: "AbC", name: "AbC" },
      }),
    ).toThrow("not permitted");
  });
  it("keeps Google disabled if settings are incomplete or gate is closed", () => {
    expect(
      options({ TASK_AUTH_ENABLED: true, AUTH_GOOGLE_CLIENT_ID: "test" }).socialProviders,
    ).toEqual({});
    expect(
      options({ AUTH_GOOGLE_CLIENT_ID: "test", AUTH_GOOGLE_CLIENT_SECRET: "fixture" })
        .socialProviders,
    ).toEqual({});
  });
  it("enables both providers independently without extra scopes", async () => {
    const configured = options({
      TASK_AUTH_ENABLED: true,
      AUTH_GOOGLE_CLIENT_ID: "test-google",
      AUTH_GOOGLE_CLIENT_SECRET: "fixture",
      AUTH_GITHUB_CLIENT_ID: "test-github",
      AUTH_GITHUB_CLIENT_SECRET: "fixture",
      TASK_ALLOWED_GOOGLE_SUBS: '["42"]',
    });
    expect(Object.keys(configured.socialProviders).sort()).toEqual(["github", "google"]);
    expect(configured.socialProviders.google).not.toHaveProperty("scope");
    expect(configured.socialProviders.google?.mapProfileToUser({ sub: "42" })).toEqual({});
    expect(() => configured.socialProviders.google?.mapProfileToUser({ sub: 42 })).toThrow(
      "not permitted",
    );
    const account = {
      id: "test",
      userId: "test",
      accountId: "42",
      providerId: "google",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    expect(await configured.databaseHooks.account.create.before(account)).toBe(true);
    expect(
      await configured.databaseHooks.account.create.before({ ...account, providerId: "github" }),
    ).toBe(false);
    expect(configured.account.accountLinking.enabled).toBe(false);
  });
});
