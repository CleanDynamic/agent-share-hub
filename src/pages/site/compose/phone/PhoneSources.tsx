/* Prompt 23: Sources on a phone, a half sheet. "Sessions in this build" 13 Text 3, then each session as a phone row: a 12px
   swatch in its colour (an empty outline when it has none), "Session 1", its line 13 Text 3, and a 44 plus that adds a step at the
   end of that session ("Add Session 1 at the end"). "Files in this build", each file. The computer's drop zone becomes two big
   buttons side by side: "Choose a file" (the native picker, the page's own) and "Import". */

import { MobileIcon } from "@/components/brand/MobileIcon";
import { BigButton } from "@/components/phone/BigButton";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_EDITOR_COPY } from "./phoneEditorModel";

export interface PhoneSourcesModel {
  sessions: readonly { key: string; number: number; line: string; colour: string | null }[];
  files: readonly { id: string; name: string; note: string }[];
  /** Add a step at the end of this session (the Add sheet, aimed at it). */
  onAddTo: (key: string) => void;
  /** The page's file picker. */
  onPick: () => void;
  importHref: string;
}

function Plus({ label, onClick }: { label: string; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{ width: 44, height: 44, padding: 0, border: 0, borderRadius: 22, background: t.control, color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="new" size={20} />
    </button>
  );
}

const HEAD = { margin: 0, padding: `12px ${PHONE_MARGIN}px 4px`, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", fontWeight: 400, color: t.label } as const;

export function PhoneSources({ open, onOpenChange, model }: { open: boolean; onOpenChange: (open: boolean) => void; model: PhoneSourcesModel | null }) {
  const importLink = useInteractive<HTMLAnchorElement>();
  return (
    <PhoneBottomSheet open={open} onOpenChange={onOpenChange} title={PHONE_EDITOR_COPY.sources} height="half" data-testid="phone-sources">
      {model ? (
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: 12 }}>
          <section aria-label={PHONE_EDITOR_COPY.sessionsIn}>
            <h3 style={HEAD}>{PHONE_EDITOR_COPY.sessionsIn}</h3>
            {model.sessions.length === 0 ? <p style={{ ...HEAD, paddingTop: 4, color: t.text2 }}>{PHONE_EDITOR_COPY.noSessions}</p> : null}
            {model.sessions.map((session) => (
              <PhoneRow
                key={session.key}
                data-testid="phone-source-session"
                lead={{ kind: "swatch", colour: session.colour }}
                title={`Session ${session.number}`}
                line={session.line}
                trail={{
                  kind: "node",
                  node: (
                    <Plus
                      label={PHONE_EDITOR_COPY.addAtEnd(session.number)}
                      onClick={() => {
                        onOpenChange(false);
                        model.onAddTo(session.key);
                      }}
                    />
                  ),
                }}
              />
            ))}
          </section>
          <section aria-label={PHONE_EDITOR_COPY.filesIn}>
            <h3 style={HEAD}>{PHONE_EDITOR_COPY.filesIn}</h3>
            {model.files.length === 0 ? <p style={{ ...HEAD, paddingTop: 4, color: t.text2 }}>{PHONE_EDITOR_COPY.noFiles}</p> : null}
            {model.files.map((file) => (
              <PhoneRow key={file.id} data-testid="phone-source-file" lead={{ kind: "icon", icon: "file" }} title={file.name} line={file.note} />
            ))}
          </section>
          <div style={{ display: "flex", gap: 8, padding: `16px ${PHONE_MARGIN}px 0` }}>
            <BigButton
              style={{ flex: "1 1 0", padding: "0 12px" }}
              onClick={() => {
                onOpenChange(false);
                model.onPick();
              }}
            >
              {PHONE_EDITOR_COPY.chooseFile}
            </BigButton>
            <PageLink
              to={model.importHref}
              {...importLink.handlers}
              style={{ flex: "1 1 0", boxSizing: "border-box", height: 48, borderRadius: 24, background: t.control, color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, textDecoration: "none", ...ring(importLink.state.focusVisible) }}
            >
              {PHONE_EDITOR_COPY.importFile}
            </PageLink>
          </div>
        </div>
      ) : null}
    </PhoneBottomSheet>
  );
}

export default PhoneSources;
