import { describe, expect, it } from "vite-plus/test";
import {
  authorizeGithubProfile,
  isAllowedGithubId,
  parseAllowedGithubIds,
} from "./github-allowlist";
import configureAuth from "../../auth";

describe("GitHub allowlist", () => {
  it.each([undefined, "", "[]", "invalid", '["42", "name"]', "[42]", '["042"]', '["0"]', '"42"'])(
    "denies every user for absent or invalid configuration %s",
    (allowlist) => {
      expect(parseAllowedGithubIds(allowlist).size).toBe(0);
      expect(() => authorizeGithubProfile({ allowlist, profile: { id: "42" } })).toThrow(
        "not permitted",
      );
    },
  );
  it("accepts only an exact immutable subject, including GitHub's numeric JSON ID", () => {
    expect(
      authorizeGithubProfile({ allowlist: '["42"]', profile: { id: "42", login: "renamed" } }),
    ).toEqual({});
    expect(authorizeGithubProfile({ allowlist: '["42"]', profile: { id: 42 } })).toEqual({});
    expect(() =>
      authorizeGithubProfile({
        allowlist: '["42"]',
        profile: { id: "43", login: "42", email: "42" },
      }),
    ).toThrow("not permitted");
  });
  it.each([null, undefined, "042", 0, -42, 42.5, Number.MAX_SAFE_INTEGER + 1, "42 "])(
    "denies invalid subject %s",
    (id) => {
      expect(isAllowedGithubId({ allowlist: '["42"]', id })).toBe(false);
    },
  );
  it("checks account creation independently and disables implicit linking", async () => {
    const configuration = configureAuth({
      defaults: {},
      env: { TASK_ALLOWED_GITHUB_IDS: '["42"]' },
      dialect: "sqlite",
      request: new Request("https://tasks.example"),
    });
    const account = {
      id: "test",
      userId: "test",
      accountId: "42",
      providerId: "github",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const before = configuration.databaseHooks.account.create.before;
    expect(await before(account)).toBe(true);
    expect(await before({ ...account, accountId: "43" })).toBe(false);
    expect(await before({ ...account, providerId: "google" })).toBe(false);
    expect(configuration.account.accountLinking.enabled).toBe(false);
  });
});
