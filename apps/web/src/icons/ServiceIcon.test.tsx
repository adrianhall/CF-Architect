/**
 * apps/web/src/icons/ServiceIcon.test.tsx
 *
 * Unit tests for the ServiceIcon component.
 *
 * Covers:
 *   - Known iconId renders an SVG with correct aria-label and href
 *   - Missing iconId (empty string) renders the accessible fallback placeholder
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ServiceIcon } from "./ServiceIcon.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ServiceIcon — known iconId", () => {
  it("renders an <svg> element", () => {
    act(() => {
      root.render(<ServiceIcon iconId="kv" name="Workers KV" />);
    });
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("sets role='img' on the svg element", () => {
    act(() => {
      root.render(<ServiceIcon iconId="kv" name="Workers KV" />);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
  });

  it("sets aria-label to the service name", () => {
    act(() => {
      root.render(<ServiceIcon iconId="kv" name="Workers KV" />);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("Workers KV");
  });

  it("includes a <use> element referencing the sprite symbol", () => {
    act(() => {
      root.render(<ServiceIcon iconId="kv" name="Workers KV" />);
    });
    const use = container.querySelector("use");
    expect(use).not.toBeNull();
    expect(use?.getAttribute("href")).toBe("/icons/sprite.svg#kv");
  });

  it("applies the given size as width and height", () => {
    act(() => {
      root.render(<ServiceIcon iconId="workers" name="Workers" size={32} />);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("defaults to size=24 when size prop is omitted", () => {
    act(() => {
      root.render(<ServiceIcon iconId="workers" name="Workers" />);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("does not render a fallback span", () => {
    act(() => {
      root.render(<ServiceIcon iconId="d1" name="D1" />);
    });
    // The span is only rendered when iconId is falsy
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(0);
  });
});

describe("ServiceIcon — missing iconId (fallback)", () => {
  it("renders a <span> placeholder when iconId is an empty string", () => {
    act(() => {
      root.render(<ServiceIcon iconId="" name="Unknown Service" />);
    });
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
  });

  it("sets role='img' on the fallback span", () => {
    act(() => {
      root.render(<ServiceIcon iconId="" name="Unknown Service" />);
    });
    const span = container.querySelector("span");
    expect(span?.getAttribute("role")).toBe("img");
  });

  it("sets aria-label on the fallback span", () => {
    act(() => {
      root.render(<ServiceIcon iconId="" name="Unknown Service" />);
    });
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-label")).toBe("Unknown Service");
  });

  it("does not render an <svg> when iconId is empty", () => {
    act(() => {
      root.render(<ServiceIcon iconId="" name="Unknown Service" />);
    });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows the first character of the name as a text fallback", () => {
    act(() => {
      root.render(<ServiceIcon iconId="" name="Workers" />);
    });
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("W");
  });
});
