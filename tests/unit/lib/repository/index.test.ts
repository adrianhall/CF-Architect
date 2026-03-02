import { describe, it, expect, vi } from "vitest";

vi.mock("@lib/db/client", () => ({
  createDb: vi.fn().mockReturnValue({ query: {} }),
}));

import {
  createRepositories,
  DiagramRepository,
  ShareRepository,
} from "@lib/repository";
import { createDb } from "@lib/db/client";

describe("createRepositories", () => {
  it("creates a db client and returns repository instances", () => {
    const fakeEnv = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
    };

    const repos = createRepositories(fakeEnv);

    expect(createDb).toHaveBeenCalledWith(fakeEnv.DB);
    expect(repos.diagrams).toBeInstanceOf(DiagramRepository);
    expect(repos.shares).toBeInstanceOf(ShareRepository);
  });
});
