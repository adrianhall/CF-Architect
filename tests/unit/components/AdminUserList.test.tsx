// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  AdminUserListResponseSchema: {},
}));

vi.mock("@islands/admin/ConfirmUserActionModal", () => ({
  default: ({
    action,
    onConfirm,
    onCancel,
  }: {
    action: { type: string; user: { id: string } } | null;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    if (!action) return null;
    return (
      <div data-testid="confirm-user-action-modal">
        <span data-testid="modal-action-type">{action.type}</span>
        <span data-testid="modal-user-id">{action.user.id}</span>
        <button data-testid="modal-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  },
}));

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import AdminUserList from "@islands/admin/AdminUserList";
import { fetchApi, type AdminUser } from "@lib/validation";

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

const CURRENT_USER_ID = "self";

const ADMIN_USER: AdminUser = {
  id: "u1",
  email: "admin@example.com",
  displayName: "Admin Alice",
  avatarUrl: null,
  isAdmin: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  diagramCount: 10,
  shareCount: 3,
};

const REGULAR_USER: AdminUser = {
  id: "u2",
  email: "bob@example.com",
  displayName: "Bob",
  avatarUrl: null,
  isAdmin: false,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  diagramCount: 5,
  shareCount: 1,
};

const SELF_USER: AdminUser = {
  id: CURRENT_USER_ID,
  email: "me@example.com",
  displayName: "Me",
  avatarUrl: null,
  isAdmin: true,
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
  diagramCount: 2,
  shareCount: 0,
};

function mockUsersResponse(
  users = [ADMIN_USER, REGULAR_USER],
  total = users.length,
) {
  return { ok: true, data: { users, total } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true })),
  );
});

describe("AdminUserList", () => {
  it("shows loading state initially", () => {
    mockFetchApi.mockReturnValue(new Promise(() => {}));
    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no users returned", async () => {
    mockFetchApi.mockResolvedValueOnce(mockUsersResponse([], 0));
    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

    await waitFor(() => {
      expect(screen.getByText("No users found.")).toBeInTheDocument();
    });
  });

  it("renders the search input with correct placeholder", async () => {
    mockFetchApi.mockResolvedValueOnce(mockUsersResponse());
    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

    const input = screen.getByPlaceholderText("Search by email\u2026");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("admin-search");

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  it("renders user rows with email, name, counts, and badges", async () => {
    mockFetchApi.mockResolvedValueOnce(mockUsersResponse());
    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

    await waitFor(() => {
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("Admin Alice")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    const adminBadges = screen.getAllByText("Admin");
    const badgeSpan = adminBadges.find(
      (el) => el.tagName === "SPAN" && el.classList.contains("admin-badge"),
    );
    expect(badgeSpan).toBeDefined();
    expect(badgeSpan).toHaveClass("admin-badge", "admin-badge--active");

    const userBadges = screen.getAllByText("User");
    expect(userBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows em-dash for null email and displayName", async () => {
    const nullUser: AdminUser = {
      ...REGULAR_USER,
      id: "u-null",
      email: null,
      displayName: null,
    };
    mockFetchApi.mockResolvedValueOnce(mockUsersResponse([nullUser], 1));
    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

    await waitFor(() => {
      const dashes = screen.getAllByText("\u2014");
      expect(dashes).toHaveLength(2);
    });
  });

  describe("action buttons visibility", () => {
    it("shows Demote and Delete for admin who is not self", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([ADMIN_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Demote")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.queryByText("Promote")).not.toBeInTheDocument();
    });

    it("shows Promote and Delete for non-admin user", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([REGULAR_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Promote")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.queryByText("Demote")).not.toBeInTheDocument();
    });

    it("hides Delete and Demote buttons for the current user", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([SELF_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("me@example.com")).toBeInTheDocument();
      });

      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
      expect(screen.queryByText("Demote")).not.toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("toggles sort order when clicking the active column header", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      const emailHeader = screen.getByText(/Email/);
      expect(emailHeader.textContent).toContain("\u25B2");

      act(() => {
        fireEvent.click(emailHeader);
      });

      await waitFor(() => {
        expect(emailHeader.textContent).toContain("\u25BC");
      });
    });

    it("switches sort column when clicking a different header", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      const nameHeader = screen.getByText(/Name/);
      act(() => {
        fireEvent.click(nameHeader);
      });

      await waitFor(() => {
        expect(nameHeader.textContent).toContain("\u25B2");
      });

      const emailHeader = screen.getByText(/Email/);
      expect(emailHeader.textContent).not.toContain("\u25B2");
      expect(emailHeader.textContent).not.toContain("\u25BC");
    });
  });

  describe("pagination", () => {
    it("renders pagination controls with page info", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([ADMIN_USER], 40));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    it("disables Previous on first page", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Previous")).toBeDisabled();
    });

    it("disables Next on last page", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      expect(screen.getByText("Next")).toBeDisabled();
    });

    it("navigates to next page", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([ADMIN_USER], 40));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByText("Next"));
      });

      await waitFor(() => {
        expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
      });
    });

    it("navigates to previous page", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([ADMIN_USER], 40));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByText("Next"));
      });

      await waitFor(() => {
        expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByText("Previous"));
      });

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
      });
    });
  });

  describe("search", () => {
    it("updates search input value on change", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const input: HTMLInputElement = screen.getByPlaceholderText(
        "Search by email\u2026",
      );
      fireEvent.change(input, { target: { value: "test@example" } });
      expect(input.value).toBe("test@example");
    });

    it("sends search param to API after debounce", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("Search by email\u2026");
      fireEvent.change(input, { target: { value: "alice" } });

      await waitFor(() => {
        const calls = mockFetchApi.mock.calls;
        const hasSearchParam = calls.some(
          (call: string[]) =>
            typeof call[0] === "string" && call[0].includes("search=alice"),
        );
        expect(hasSearchParam).toBe(true);
      });
    });
  });

  describe("error handling", () => {
    it("displays error message when fetch fails", async () => {
      mockFetchApi.mockResolvedValueOnce({
        ok: false,
        error: { message: "Something went wrong" },
      });
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      expect(screen.getByText("Something went wrong").closest("p")).toHaveClass(
        "admin-error",
      );
    });
  });

  describe("modal actions", () => {
    it("opens delete modal when Delete button is clicked", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([REGULAR_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      expect(
        screen.getByTestId("confirm-user-action-modal"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("modal-action-type")).toHaveTextContent(
        "delete",
      );
      expect(screen.getByTestId("modal-user-id")).toHaveTextContent("u2");
    });

    it("opens promote modal when Promote button is clicked", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([REGULAR_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Promote"));

      expect(screen.getByTestId("modal-action-type")).toHaveTextContent(
        "promote",
      );
    });

    it("opens demote modal when Demote button is clicked", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([ADMIN_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Demote"));

      expect(screen.getByTestId("modal-action-type")).toHaveTextContent(
        "demote",
      );
    });

    it("closes modal when cancel is clicked", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse([REGULAR_USER], 1));
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      expect(
        screen.getByTestId("confirm-user-action-modal"),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("modal-cancel"));
      expect(
        screen.queryByTestId("confirm-user-action-modal"),
      ).not.toBeInTheDocument();
    });

    it("calls DELETE endpoint on confirm delete", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/users/u2", {
          method: "DELETE",
        });
      });
    });

    it("calls PATCH endpoint on confirm promote", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Promote"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/users/u2", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAdmin: true }),
        });
      });
    });

    it("calls PATCH with isAdmin false on confirm demote", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([ADMIN_USER], 1));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Demote"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/v1/admin/users/u1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAdmin: false }),
        });
      });
    });

    it("displays error when delete fails", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, error: { message: "Delete failed" } }),
          { status: 500 },
        ),
      );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
    });

    it("displays error when promote/demote fails", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, error: { message: "Update failed" } }),
          { status: 500 },
        ),
      );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Promote"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });
    });

    it("uses fallback error message when server provides none on delete", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: false }), { status: 500 }),
      );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
    });

    it("uses fallback error for promote when server provides none", async () => {
      mockFetchApi.mockResolvedValue(mockUsersResponse([REGULAR_USER], 1));
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: false }), { status: 500 }),
      );

      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Promote"));
      fireEvent.click(screen.getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });
    });
  });

  describe("table headers", () => {
    it("renders all column headers", async () => {
      mockFetchApi.mockResolvedValueOnce(mockUsersResponse());
      render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText(/Email/)).toBeInTheDocument();
      expect(screen.getByText(/Name/)).toBeInTheDocument();
      expect(screen.getByText("Diagrams")).toBeInTheDocument();
      expect(screen.getByText("Shares")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  it("does not fire action when modalAction is null", async () => {
    mockFetchApi.mockResolvedValueOnce(mockUsersResponse([REGULAR_USER], 1));
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    render(<AdminUserList currentUserId={CURRENT_USER_ID} />);

    await waitFor(() => {
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId("confirm-user-action-modal"),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/admin/users/"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
