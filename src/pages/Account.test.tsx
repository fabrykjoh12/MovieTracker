import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Account } from "./Account";

const auth = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string } | null,
  status: "anonymous" as "anonymous" | "authenticated",
  isConfigured: true,
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    ...auth,
  }),
}));

const store = vi.hoisted(() => ({
  librarySync: { status: "browser", message: undefined } as {
    status: "browser" | "needs-import";
    message?: string;
  },
  startCloudSync: vi.fn(),
  retryCloudSync: vi.fn(),
}));

vi.mock("../store", () => ({
  useStore: () => ({
    state: { userMedia: { severance: {}, arrival: {} } },
    ...store,
  }),
}));

function renderAccount() {
  return render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );
}

describe("account password setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requestPasswordReset.mockResolvedValue({});
    auth.resetPassword.mockResolvedValue({});
    auth.signInWithPassword.mockResolvedValue({});
    auth.signOut.mockResolvedValue({});
    auth.user = null;
    auth.status = "anonymous";
    store.librarySync = { status: "browser", message: undefined };
    window.history.replaceState(null, "", "/#/account");
  });

  it("requests a secure password link for a provisioned account", async () => {
    const user = userEvent.setup();
    renderAccount();

    await user.click(
      screen.getByRole("button", { name: "Set or reset password" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "viewer@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Send password link" }),
    );

    await waitFor(() => {
      expect(auth.requestPasswordReset).toHaveBeenCalledWith(
        "viewer@example.com",
        expect.stringContaining("#/account"),
      );
    });
    expect(
      screen.getByRole("heading", {
        name: "Your password link is on its way.",
      }),
    ).toBeInTheDocument();
  });

  it("sets matching passwords from a valid reset link", async () => {
    window.history.replaceState(null, "", "/?token=reset-token#/account");
    const user = userEvent.setup();
    renderAccount();

    await user.type(
      screen.getByLabelText("New password"),
      "cinema-archive-2026",
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "cinema-archive-2026",
    );
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(auth.resetPassword).toHaveBeenCalledWith(
        "cinema-archive-2026",
        "reset-token",
      );
    });
    expect(
      screen.getByText("Password set. You can sign in now."),
    ).toBeInTheDocument();
  });

  it("requires an explicit action before copying a browser library", async () => {
    auth.user = {
      id: "user-1",
      email: "viewer@example.com",
      name: "Viewer",
    };
    auth.status = "authenticated";
    store.librarySync = { status: "needs-import", message: undefined };
    const user = userEvent.setup();
    renderAccount();

    expect(
      screen.getByText("Finish setting up your cloud library"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Copy 2 browser titles/i)).toBeInTheDocument();
    expect(store.startCloudSync).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Copy library to Neon" }),
    );
    expect(store.startCloudSync).toHaveBeenCalledOnce();
  });
});
