import { describe, it, expect, vi } from "vitest";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn().mockReturnValue({ query: {} }),
}));

import { createDb } from "@lib/db/client";
import * as schema from "@lib/db/schema";
import { drizzle } from "drizzle-orm/d1";

describe("createDb", () => {
  it("calls drizzle with the D1 binding and schema", () => {
    const fakeD1 = {} as D1Database;
    const db = createDb(fakeD1);

    expect(drizzle).toHaveBeenCalledWith(fakeD1, { schema });
    expect(db).toEqual({ query: {} });
  });
});
