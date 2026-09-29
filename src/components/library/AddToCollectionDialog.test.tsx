// RC-P18 — "Add to a collection", and the Save toast that opens it.
//
// The claims: a successful Save toasts "Saved." with one text action, "Add to
// a collection", which asks for the dialog for that build; choosing a
// collection puts the build in it and says so; "Create and add" makes a
// collection and puts the build in it; a refusal is one sentence and names
// nothing the reader wrote.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader-1" }, isLoggedIn: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const saveBuild = vi.fn();
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  saveBuild: (...args: unknown[]) => saveBuild(...args),
}));

const listCollections = vi.fn();
const addBuildToCollection = vi.fn();
const startCollection = vi.fn();
vi.mock("@/lib/library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library")>()),
  listCollections: (...args: unknown[]) => listCollections(...args),
  addBuildToCollection: (...args: unknown[]) => addBuildToCollection(...args),
  startCollection: (...args: unknown[]) => startCollection(...args),
}));

import { AddToCollectionDialog } from "@/components/library/AddToCollectionDialog";
import { closeAddToCollection, useAddToCollectionRequest } from "@/components/library/addToCollection";
import { EngagementRow } from "@/components/social/EngagementRow";
import { SocialError } from "@/lib/social";

const COLLECTION = (n: number) => ({
  id: `col-${n}`,
  ownerId: "reader-1",
  name: `Collection ${n}`,
  isPrivate: true,
  itemCount: n,
  lastUsedAt: "2026-09-28T10:00:00.000Z",
});

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function Requested() {
  return <span data-testid="requested">{useAddToCollectionRequest() ?? "none"}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  closeAddToCollection();
  listCollections.mockResolvedValue([COLLECTION(1), COLLECTION(2)]);
  addBuildToCollection.mockResolvedValue(undefined);
});

describe("the Save toast", () => {
  it("offers one text action after a save, which asks for the dialog for that build", async () => {
    saveBuild.mockResolvedValue(undefined);
    withClient(
      <>
        <EngagementRow
          build={{ id: "build-7", slug: "build-7", title: "Build 7" }}
          counts={{ likes: 0, comments: 0 }}
          liked={false}
          saved={false}
          variant="card"
        />
        <Requested />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void }; actionButtonStyle: { background: string } }];
    expect(message).toBe("Saved.");
    expect(options.action.label).toBe("Add to a collection");
    expect(options.actionButtonStyle.background).toBe("transparent");

    options.action.onClick();
    await waitFor(() => expect(screen.getByTestId("requested").textContent).toBe("build-7"));
  });
});

describe("AddToCollectionDialog", () => {
  it("puts the build in the collection chosen, says so, and closes", async () => {
    const onClose = vi.fn();
    withClient(<AddToCollectionDialog buildId="build-7" onClose={onClose} />);

    const rows = await screen.findAllByTestId("collection-choice");
    expect(rows.map((row) => row.textContent)).toEqual(["Collection 11 build", "Collection 22 builds"]);
    fireEvent.click(rows[1]);

    await waitFor(() => expect(addBuildToCollection).toHaveBeenCalledWith("col-2", "build-7"));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Added to Collection 2."));
    expect(onClose).toHaveBeenCalled();
  });

  it("makes a new collection and puts the build in it", async () => {
    startCollection.mockResolvedValue({ ...COLLECTION(9), name: "Invoices" });
    const onClose = vi.fn();
    withClient(<AddToCollectionDialog buildId="build-7" onClose={onClose} />);
    await screen.findAllByTestId("collection-choice");

    const dialog = screen.getByTestId("add-to-collection-dialog");
    const create = within(dialog).getByRole("button", { name: "Create and add" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("New collection"), { target: { value: "Invoices" } });
    fireEvent.click(create);

    await waitFor(() => expect(startCollection).toHaveBeenCalledWith("Invoices"));
    await waitFor(() => expect(addBuildToCollection).toHaveBeenCalledWith("col-9", "build-7"));
    expect(onClose).toHaveBeenCalled();
  });

  it("says a refusal in one sentence and keeps the dialog open", async () => {
    addBuildToCollection.mockRejectedValue(
      new SocialError("addBuildToCollection", "no_access", { collectionId: "col-1", buildId: "build-7" }, "42501", 403),
    );
    const onClose = vi.fn();
    withClient(<AddToCollectionDialog buildId="build-7" onClose={onClose} />);

    fireEvent.click((await screen.findAllByTestId("collection-choice"))[0]);

    expect((await screen.findByRole("alert")).textContent).toBe("You don't have access to this.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says so when the reader has no collections yet, with the field as the way on", async () => {
    listCollections.mockResolvedValue([]);
    withClient(<AddToCollectionDialog buildId="build-7" onClose={vi.fn()} />);
    expect((await screen.findByTestId("collection-choices-empty")).textContent).toBe("No collections yet.");
    expect(screen.getByLabelText("New collection")).toBeTruthy();
  });
});
