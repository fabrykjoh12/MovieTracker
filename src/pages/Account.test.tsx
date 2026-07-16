import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Account } from "./Account";

const auth = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    status: "anonymous",
    isConfigured: true,
    ...auth,
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
});
