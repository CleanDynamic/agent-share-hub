/* UX-06 Part 4: Add to a draft. The reader's eight most recently edited drafts, then New draft; choosing one copies the step into
   it (`addStepToDraft`, SV-18's insert path), and the toast says `Added to <draft title>.` with Open draft. Signed out, it goes to
   sign in and back.

   Two forms of the one menu: a text button in a reply's action row (`AddToDraftButton`), and a sub-menu inside a step's own menu
   (`AddToDraftSub`). The drafts are read when the menu opens, on the key Drafts and Home read them on. */

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { createBuild } from "@/lib/build/builds";
import { listDraftsWithSessions } from "@/lib/build/drafts";
import { reportError } from "@/lib/errors/report";
import { addStepToDraft, stepSnapshotFor, type StepToCopy } from "@/lib/openbuilds/addToDraft";

import { MENU_Z, TextButton } from "./PostReplies";

/** The drafts the menu lists. */
export const RECENT_DRAFTS = 8;
export const UNTITLED_DRAFT = "Untitled build";
export const ADD_FAILED = "That step didn't copy. Try again.";

const draftsKey = (userId: string | null) => ["build", "listDraftsWithSessions", userId] as const;

/** The menu's state and its one action, shared by both forms. */
function useAddToDraft(step: StepToCopy, open: boolean) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const drafts = useQuery({ queryKey: draftsKey(userId), queryFn: () => listDraftsWithSessions(userId), enabled: open && userId !== null });
  const signIn = () => navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`);

  const add = async (target: { id: string; title: string } | "new") => {
    try {
      const snapshot = await stepSnapshotFor(step);
      const draft = target === "new" ? await createBuild({ title: UNTITLED_DRAFT }) : null;
      const id = draft ? draft.id : (target as { id: string }).id;
      const title = draft ? (draft.title ?? UNTITLED_DRAFT) : (target as { title: string }).title;
      await addStepToDraft(id, snapshot);
      void qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] });
      toast(`Added to ${title}.`, { action: { label: "Open draft", onClick: () => navigate(`/compose/${id}`) } });
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "addStepToDraft" });
      toast.error(ADD_FAILED);
    }
  };

  const items: ReactNode =
    drafts.isError ? (
      <DropdownMenuItem disabled>Your drafts didn't load.</DropdownMenuItem>
    ) : (
      <>
        {(drafts.data ?? []).slice(0, RECENT_DRAFTS).map((draft) => {
          const title = draft.title?.trim() || UNTITLED_DRAFT;
          return (
            <DropdownMenuItem key={draft.id} onSelect={() => void add({ id: draft.id, title })}>
              {title}
            </DropdownMenuItem>
          );
        })}
        {(drafts.data ?? []).length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onSelect={() => void add("new")}>New draft</DropdownMenuItem>
      </>
    );
  return { signedIn: userId !== null, signIn, items };
}

/** In a reply's action row. */
export function AddToDraftButton({ step }: { step: StepToCopy }) {
  const [open, setOpen] = useState(false);
  const menu = useAddToDraft(step, open);
  if (!menu.signedIn) return <TextButton onClick={menu.signIn}>Add to a draft</TextButton>;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <TextButton>Add to a draft</TextButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label="Add to a draft" style={{ zIndex: MENU_Z }}>
        {menu.items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inside a step's menu. */
export function AddToDraftSub({ step }: { step: StepToCopy }) {
  const [open, setOpen] = useState(false);
  const menu = useAddToDraft(step, open);
  if (!menu.signedIn) return <DropdownMenuItem onSelect={menu.signIn}>Add to a draft</DropdownMenuItem>;
  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger>Add to a draft</DropdownMenuSubTrigger>
      <DropdownMenuSubContent aria-label="Add to a draft" style={{ zIndex: MENU_Z }}>
        {menu.items}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
