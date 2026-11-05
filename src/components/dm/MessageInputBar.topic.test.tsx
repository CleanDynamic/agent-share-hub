// UX-09 Q4: a topic handed over by "Message @maya" waits in the message box as a card, and goes with the reader's note on Send.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const sendTopicMessage = vi.fn(async (_thread: string, _topic: string, _note?: string) => undefined);
const sendBuildMessage = vi.fn(async () => undefined);

vi.mock("@/lib/messaging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/messaging")>()),
  sendTopicMessage: (thread: string, topic: string, note?: string) => sendTopicMessage(thread, topic, note),
  sendBuildMessage: () => sendBuildMessage(),
  listShareableBuilds: vi.fn(async () => []),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, profile: null, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { MessageInputBar } from "./MessageInputBar";

let stateNow: unknown = "unread";
function State() {
  stateNow = useLocation().state;
  return null;
}

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: "/messages/t1", state: { shareTopic: { id: "topic-1", label: "Speaker names from audio", subtitle: "@maya" } } }]}>
        <Routes>
          <Route
            path="/messages/:threadId"
            element={
              <>
                <MessageInputBar threadId="t1" otherDisplayName="Maya" replyToId={null} onClearReply={() => undefined} onMessageSent={() => undefined} />
                <State />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MessageInputBar: a topic from its page", () => {
  it("shows the topic waiting, clears the router state, and sends it with the note", async () => {
    mount();
    expect(await screen.findByText("Speaker names from audio")).toBeInTheDocument();
    expect(screen.getByText("@maya")).toBeInTheDocument();
    await waitFor(() => expect(stateNow).toBeNull());

    fireEvent.change(screen.getByPlaceholderText("Add a note (optional)…"), { target: { value: "Can you help?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendTopicMessage).toHaveBeenCalledWith("t1", "topic-1", "Can you help?"));
    expect(sendBuildMessage).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Speaker names from audio")).toBeNull());
  });
});
