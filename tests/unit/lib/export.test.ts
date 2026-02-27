// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateExportFilename, triggerDownload } from "@lib/export";

describe("generateExportFilename", () => {
  const fixed = new Date(2026, 1, 26, 14, 5); // 2026-02-26 14:05

  it("formats a normal title with date and time", () => {
    expect(generateExportFilename("My Diagram", "png", fixed)).toBe(
      "My_Diagram_2026-02-26_1405.png",
    );
  });

  it("uses svg extension for svg format", () => {
    expect(generateExportFilename("Architecture", "svg", fixed)).toBe(
      "Architecture_2026-02-26_1405.svg",
    );
  });

  it("uses json extension for json format", () => {
    expect(generateExportFilename("My Diagram", "json", fixed)).toBe(
      "My_Diagram_2026-02-26_1405.json",
    );
  });

  it("replaces special characters with underscores", () => {
    expect(generateExportFilename("Dia/gram: v2!", "png", fixed)).toBe(
      "Dia_gram_v2_2026-02-26_1405.png",
    );
  });

  it("collapses multiple underscores and trims edges", () => {
    expect(generateExportFilename("__Hello___World__", "svg", fixed)).toBe(
      "Hello_World_2026-02-26_1405.svg",
    );
  });

  it("falls back to 'diagram' for an empty title", () => {
    expect(generateExportFilename("", "png", fixed)).toBe(
      "diagram_2026-02-26_1405.png",
    );
  });

  it("falls back to 'diagram' for a title with only special chars", () => {
    expect(generateExportFilename("!!!", "svg", fixed)).toBe(
      "diagram_2026-02-26_1405.svg",
    );
  });

  it("zero-pads single-digit months, days, hours, and minutes", () => {
    const jan = new Date(2026, 0, 3, 9, 2); // 2026-01-03 09:02
    expect(generateExportFilename("Test", "png", jan)).toBe(
      "Test_2026-01-03_0902.png",
    );
  });

  it("defaults to current date when now is omitted", () => {
    const result = generateExportFilename("Title", "png");
    expect(result).toMatch(/^Title_\d{4}-\d{2}-\d{2}_\d{4}\.png$/);
  });
});

describe("triggerDownload", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node) as unknown as ReturnType<
      typeof vi.fn
    >;
    removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node) as unknown as ReturnType<
      typeof vi.fn
    >;
    vi.spyOn(document, "createElement").mockImplementation(
      () =>
        ({
          href: "",
          download: "",
          click: clickSpy,
        }) as unknown as HTMLAnchorElement,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor with the correct href and download attributes", () => {
    triggerDownload("data:image/png;base64,abc", "test.png");

    const anchor = (document.createElement as ReturnType<typeof vi.fn>).mock
      .results[0].value as HTMLAnchorElement;
    expect(anchor.href).toBe("data:image/png;base64,abc");
    expect(anchor.download).toBe("test.png");
  });

  it("appends the anchor, clicks it, then removes it", () => {
    triggerDownload("data:image/svg+xml,<svg/>", "file.svg");

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    const callOrder = [
      appendSpy.mock.invocationCallOrder[0],
      clickSpy.mock.invocationCallOrder[0],
      removeSpy.mock.invocationCallOrder[0],
    ];
    expect(callOrder).toStrictEqual(
      [...callOrder].sort((a, b) => (a ?? 0) - (b ?? 0)),
    );
  });
});
