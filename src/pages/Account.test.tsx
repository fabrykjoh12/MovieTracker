import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const store = vi.hoisted(() => {
  const store = {
    state: { userMedia: { severance: {}, arrival: {} } } as {
      userMedia: Record<string, unknown>;
    },
    librarySync: { status: "browser", message: undefined } as {
      status: "browser" | "needs-import" | "import-error";
      message?: string;
    },
    startCloudSync: vi.fn(),
    retryCloudSync: vi.fn(),
    downloadExport: vi.fn(() => {
      const blob = new Blob(["{}"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "movietracker-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }),
    deleteAllData: vi.fn(async () => {
      store.state = { userMedia: {} };
    }),
  };
  return store;
});

vi.mock("../store", () => ({
  useStore: () => ({
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
    store.state = { userMedia: { severance: {}, arrival: {} } };
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

  it("retries an interrupted first copy instead of treating it as synced", async () => {
    auth.user = {
      id: "user-1",
      email: "viewer@example.com",
      name: "Viewer",
    };
    auth.status = "authenticated";
    store.librarySync = {
      status: "import-error",
      message: "The first copy stopped.",
    };
    const user = userEvent.setup();
    renderAccount();

    expect(
      screen.getByText("The library copy stopped early"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry library copy" }),
    );
    expect(store.startCloudSync).toHaveBeenCalledOnce();
    expect(store.retryCloudSync).not.toHaveBeenCalled();
  });
});

describe("account data controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    auth.status = "anonymous";
    store.librarySync = { status: "browser", message: undefined };
    store.state = { userMedia: { severance: {}, arrival: {} } };
    window.history.replaceState(null, "", "/#/account");
  });

  it("exports account data as a downloaded JSON file", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: /export my data/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });

  it("requires typing DELETE before wiping data", async () => {
    renderAccount();

    const deleteButton = screen.getByRole("button", {
      name: /delete all my data/i,
    });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
      target: { value: "DELETE" },
    });
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(screen.getByText(/your library is empty/i)).toBeInTheDocument(),
    );
  });
});
