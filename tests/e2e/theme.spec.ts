import { test, expect } from "@playwright/test";

test.describe("Theme initialisation (FOUC guard)", () => {
  test("applies dark class when localStorage theme is dark", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
    });

    await page.goto("/dashboard");

    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(hasDark).toBe(true);
  });

  test("does not apply dark class when localStorage theme is light", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("theme", "light");
    });

    await page.goto("/dashboard");

    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(hasDark).toBe(false);
  });

  test("respects system prefers-color-scheme: dark when no stored theme", async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.removeItem("theme");
    });

    await page.goto("/dashboard");

    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(hasDark).toBe(true);

    await context.close();
  });

  test("respects system prefers-color-scheme: light when no stored theme", async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: "light" });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.removeItem("theme");
    });

    await page.goto("/dashboard");

    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(hasDark).toBe(false);

    await context.close();
  });
});
