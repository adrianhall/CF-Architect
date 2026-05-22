import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { upsertUser } from "./users.js";
import { getUserPreferences, setUserPreferences } from "./preferences.js";

async function makeUser(email: string) {
  const sub = `pref-${crypto.randomUUID()}`;
  await upsertUser({ d1: env.DB, sub, email });
  return sub;
}

describe("getUserPreferences", () => {
  it("returns defaults when no row exists", async () => {
    const userId = await makeUser("prefs-default@example.com");
    const prefs = await getUserPreferences({ d1: env.DB, userId });

    expect(prefs.userId).toBe(userId);
    expect(prefs.theme).toBe("system");
    expect(prefs.aiPanelEnabled).toBe(1);
    expect(prefs.paletteStateJson).toBeNull();
  });
});

describe("setUserPreferences", () => {
  it("creates a preferences row on first call", async () => {
    const userId = await makeUser("prefs-create@example.com");
    await setUserPreferences({ d1: env.DB, userId, theme: "dark" });
    const prefs = await getUserPreferences({ d1: env.DB, userId });
    expect(prefs.theme).toBe("dark");
  });

  it("merges partial updates — unset fields keep their previous value", async () => {
    const userId = await makeUser("prefs-merge@example.com");
    await setUserPreferences({ d1: env.DB, userId, theme: "dark", aiPanelEnabled: false });
    await setUserPreferences({ d1: env.DB, userId, theme: "light" });
    const prefs = await getUserPreferences({ d1: env.DB, userId });
    expect(prefs.theme).toBe("light");
    expect(prefs.aiPanelEnabled).toBe(0); // unchanged from prior call
  });

  it("stores and returns aiPanelEnabled as an integer", async () => {
    const userId = await makeUser("prefs-bool@example.com");
    await setUserPreferences({ d1: env.DB, userId, aiPanelEnabled: false });
    const prefs = await getUserPreferences({ d1: env.DB, userId });
    expect(prefs.aiPanelEnabled).toBe(0);
  });

  it("updates paletteStateJson", async () => {
    const userId = await makeUser("prefs-palette@example.com");
    const json = JSON.stringify(["compute", "storage"]);
    await setUserPreferences({ d1: env.DB, userId, paletteStateJson: json });
    const prefs = await getUserPreferences({ d1: env.DB, userId });
    expect(prefs.paletteStateJson).toBe(json);
  });
});
