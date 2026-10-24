/* CA-25 P3: a published build's options, in the title row beside View live.

   "Published build options" is a 28 square ghost button with the dots (44 on a phone). Its menu is 200 wide: "Copy link"
   (the full live address, then the notice "Link copied"), a rule, and "Unpublish…" in the danger text colour. Unpublish asks in
   a 420 window: "Unpublish {title}?", "The link stops working. The draft stays.", Cancel and Unpublish in the danger text colour.
   `canUnpublish` false (the database refused it) leaves the item out. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";

import { TitleIcon } from "./BuildTitleActions";
import { MenuContent } from "./ComposeMenu";
import { RecipeButton, LABEL } from "./modalRecipes";
import { PublishFrame } from "./PublishChecklist";
import { DANGER } from "./referencePieces";
import { menuItem, menuSurface } from "./refinedStyles";
import { DangerButton } from "./removePieces";
import { useBuildHistoryContext } from "./useBuildHistory";

export const PUBLISHED_COPY = {
  options: "Published build options",
  viewLive: "View live",
  copyLink: "Copy link",
  copied: "Link copied",
  copyFailed: "Couldn't copy the link",
  unpublish: "Unpublish…",
  unpublishTitle: (title: string): string => `Unpublish ${title}?`,
  unpublishBody: "The link stops working. The draft stays.",
  cancel: "Cancel",
  confirm: "Unpublish",
} as const;

/** The build's live address in full, as a reader opens it. */
export const liveUrl = (slug: string): string => `${typeof window === "undefined" ? "" : window.location.origin}/b2/${slug}`;

export function PublishedOptions({ slug, title, onUnpublish, canUnpublish = true }: { slug: string; title: string; onUnpublish: () => void; canUnpublish?: boolean }) {
  const phone = useIsPhone();
  const history = useBuildHistoryContext();
  const [asking, setAsking] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl(slug));
      history?.notify(PUBLISHED_COPY.copied, { undo: false });
    } catch {
      history?.notify(PUBLISHED_COPY.copyFailed, { undo: false });
    }
  };

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <TitleIcon glyph="more" phone={phone} label={PUBLISHED_COPY.options} title={PUBLISHED_COPY.options} data-testid="published-options" />
        </Menu.Trigger>
        <Menu.Portal>
          <MenuContent align="end" sideOffset={6} style={menuSurface(200)}>
            <Menu.Item data-testid="published-copy-link" onSelect={() => void copy()} style={menuItem(true, phone)}>
              {PUBLISHED_COPY.copyLink}
            </Menu.Item>
            {canUnpublish ? (
              <>
                <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
                <Menu.Item data-testid="published-unpublish" data-tone="danger" onSelect={() => setAsking(true)} style={{ ...menuItem(true, phone), color: DANGER }}>
                  {PUBLISHED_COPY.unpublish}
                </Menu.Item>
              </>
            ) : null}
          </MenuContent>
        </Menu.Portal>
      </Menu.Root>
      <PublishFrame
        open={asking}
        onClose={() => setAsking(false)}
        title={PUBLISHED_COPY.unpublishTitle(title)}
        width={420}
        testId="unpublish-window"
        body={
          <p data-testid="unpublish-body" style={{ ...LABEL, margin: "4px 0 0" }}>
            {PUBLISHED_COPY.unpublishBody}
          </p>
        }
        footer={
          <>
            <span style={{ flexGrow: 1 }} />
            <RecipeButton small={!phone} phone={phone} data-testid="unpublish-cancel" onClick={() => setAsking(false)}>
              {PUBLISHED_COPY.cancel}
            </RecipeButton>
            <DangerButton
              phone={phone}
              testId="unpublish-confirm"
              onClick={() => {
                setAsking(false);
                onUnpublish();
              }}
            >
              {PUBLISHED_COPY.confirm}
            </DangerButton>
          </>
        }
      />
    </>
  );
}
