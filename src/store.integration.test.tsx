import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "./data";
import type { LibrarySyncRepository } from "./repositories/contracts";
import { StoreProvider, useStore } from "./store";

const auth = vi.hoisted(() => ({
  status: "authenticated" as const,
  user: {
    id: "account-a",
    email: "account-a@example.com",
    name: "Account A",
  },
}));

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

vi.mock("./lib/neon", () => ({
  getNeonClient: () => Promise.resolve({}),
  isNeonConfigured: true,
}));

vi.mock("./repositories/localStateRepository", () => ({
  createLocalStateRepository: () => ({
    load: (fallback: typeof initialState) => fallback,
    save: vi.fn(),
  }),
}));

vi.mock("./repositories/localCatalogRepository", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("./repositories/localCatalogRepository")
    >();
  return {
    ...original,
    createLocalCatalogRepository: () => ({
      load: () => [],
      save: vi.fn(),
    }),
  };
});

const repository = vi.hoisted(() => ({
  load: vi.fn(),
  refreshCatalog: vi.fn(),
  saveState: vi.fn(),
  removeState: vi.fn(),
  reorderQueue: vi.fn(),
  import: vi.fn(),
  persistChanges: vi.fn(),
  deleteAllData: vi.fn(),
}));

const MockLibraryConflictError = vi.hoisted(() => class extends Error {});

vi.mock("./repositories/neonLibraryRepository", () => ({
  createNeonLibraryRepository: () =>
    repository as unknown as LibrarySyncRepository,
  LibraryConflictError: MockLibraryConflictError,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function StoreProbe() {
  const { state, dispatch, librarySync, downloadExport, deleteAllData } =
    useStore();
  return (
    <>
      <output aria-label="Severance state">
        {state.userMedia.severance?.status}
      </output>
      <output aria-label="Cloud status">{librarySync.status}</output>
      <output aria-label="Cloud message">{librarySync.message}</output>
      <output aria-label="Library size">
        {Object.keys(state.userMedia).length}
      </output>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "status", mediaId: "severance", status: "paused" })
        }
      >
        Pause Severance
      </button>
      <button type="button" onClick={() => downloadExport()}>
        Export
      </button>
      <button type="button" onClick={() => void deleteAllData()}>
        Delete all
      </button>
    </>
  );
}

describe("cloud mutation recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.load.mockResolvedValue({
      initialized: true,
      userMedia: initialState.userMedia,
      events: initialState.events,
      queue: initialState.queue,
      catalog: media,
    });
    repository.refreshCatalog.mockResolvedValue(media);
  });

  it("shows an optimistic change, then visibly restores the previous state", async () => {
    const mutation = deferred<void>();
    repository.persistChanges.mockReturnValueOnce(mutation.promise);
    const user = userEvent.setup();

    render(
      <StoreProvider>
        <StoreProbe />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Cloud status")).toHaveTextContent("synced");
    });
    expect(screen.getByLabelText("Severance state")).toHaveTextContent(
      "watching",
    );

    await user.click(screen.getByRole("button", { name: "Pause Severance" }));
    expect(screen.getByLabelText("Severance state")).toHaveTextContent(
      "paused",
    );
    expect(screen.getByLabelText("Cloud status")).toHaveTextContent("saving");

    await act(async () => {
      mutation.reject(new Error("The network rejected the change."));
      await mutation.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Cloud status")).toHaveTextContent("error");
    });
    expect(screen.getByLabelText("Severance state")).toHaveTextContent(
      "watching",
    );
    expect(screen.getByLabelText("Cloud message")).toHaveTextContent(
      "The network rejected the change.",
    );
  });
});

describe("real store export and cloud deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.load.mockResolvedValue({
      initialized: true,
      userMedia: initialState.userMedia,
      events: initialState.events,
      queue: initialState.queue,
      catalog: media,
    });
    repository.refreshCatalog.mockResolvedValue(media);
  });

  it("returns to setup after a successful cloud delete", async () => {
    repository.deleteAllData.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <StoreProvider>
        <StoreProbe />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Cloud status")).toHaveTextContent("synced");
    });

    await user.click(screen.getByRole("button", { name: "Delete all" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Cloud status")).toHaveTextContent(
        "needs-import",
      );
    });
    expect(repository.deleteAllData).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Library size")).toHaveTextContent("0");
  });

  it("downloads a JSON export as a Blob", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      const user = userEvent.setup();

      render(
        <StoreProvider>
          <StoreProbe />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Cloud status")).toHaveTextContent(
          "synced",
        );
      });

      await user.click(screen.getByRole("button", { name: "Export" }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });
});
