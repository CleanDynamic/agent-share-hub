/* CA-25 P2: the last look before Publish.

   A 480 window of the modal recipes: "Publish {title}?" (15/500), under it "Visible to anyone with the link." (12.5 `--text2`),
   then Public and Private (labels at 12 `--label`). A public row is 44 tall, split by a 1px `--hairline`: the name at 13 on the left,
   the value at 12.5 `--text2` at the right, cut to one line. What stays private is one line in `--text2`. Cancel and Publish below. */

import type { CSSProperties } from "react";

import { ActionSheet } from "@/components/phone/ActionSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONFIRM_COPY, type ConfirmRow } from "@/lib/build/publishChecklist";
import { t } from "@/lib/theme/tokens";

import { ELLIPSIS, RecipeButton, MODAL_WIDTH } from "./modalRecipes";
import { PublishFrame } from "./PublishChecklist";
import { text } from "./refinedStyles";

import { textStep } from "@/lib/theme/type";
const LINE: CSSProperties = { ...text(textStep.meta, 400, t.text2), margin: "4px 0 0" };
const SECTION_LABEL: CSSProperties = { ...text(textStep.meta, 400, t.label), margin: "14px 0 4px" };
const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 44, boxSizing: "border-box" };

export interface PublishConfirmProps {
  open: boolean;
  title: string;
  rows: readonly ConfirmRow[];
  onCancel: () => void;
  /** Runs the publish. The window has already closed. */
  onPublish: () => void;
}

export function PublishConfirm({ open, title, rows, onCancel, onPublish }: PublishConfirmProps) {
  const phone = useIsPhone();
  /* Prompt 24: on a phone, an action sheet: the line, what goes public (each "name · value") and what stays private, then
     Publish and Cancel. */
  if (phone) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={(next) => !next && onCancel()}
        title={CONFIRM_COPY.title(title)}
        explanation={CONFIRM_COPY.line}
        action={{
          label: CONFIRM_COPY.publish,
          onSelect: () => {
            onCancel();
            onPublish();
          },
        }}
        cancelLabel={CONFIRM_COPY.cancel}
        data-testid="publish-confirm"
        actionTestId="confirm-publish"
        cancelTestId="confirm-cancel"
      >
        <section aria-label={CONFIRM_COPY.public} style={{ margin: "0 0 8px" }}>
          <h3 style={{ ...text(textStep.meta, 400, t.label), margin: "0 0 4px" }}>{CONFIRM_COPY.public}</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((row) => (
              <li key={row.key} data-testid={`confirm-${row.key}`} style={{ ...text(15, 400, t.text), padding: "4px 0", overflowWrap: "anywhere" }}>
                {row.name}
                <span data-testid={`confirm-${row.key}-value`} style={{ color: t.text2 }}>{` · ${row.value}`}</span>
              </li>
            ))}
          </ul>
          <h3 style={{ ...text(textStep.meta, 400, t.label), margin: "12px 0 4px" }}>{CONFIRM_COPY.private}</h3>
          <p data-testid="confirm-private" style={{ ...text(textStep.meta, 400, t.text2), margin: 0 }}>
            {CONFIRM_COPY.privateRow}
          </p>
        </section>
      </ActionSheet>
    );
  }
  return (
    <PublishFrame
      open={open}
      onClose={onCancel}
      title={CONFIRM_COPY.title(title)}
      width={MODAL_WIDTH.standard}
      testId="publish-confirm"
      body={
        <>
          <p data-testid="confirm-line" style={LINE}>
            {CONFIRM_COPY.line}
          </p>
          <section aria-label={CONFIRM_COPY.public}>
            <h3 style={{ ...SECTION_LABEL, fontWeight: 400 }}>{CONFIRM_COPY.public}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.map((row, at) => (
                <li key={row.key} data-testid={`confirm-${row.key}`} style={{ ...ROW, ...(at === 0 ? null : { borderTop: `1px solid ${t.hairline}` }) }}>
                  <span style={{ ...text(textStep.body, 400, t.text), flexShrink: 0 }}>{row.name}</span>
                  <span data-testid={`confirm-${row.key}-value`} title={row.value} style={{ ...text(textStep.meta, 400, t.text2), ...ELLIPSIS, flexGrow: 1, textAlign: "right" }}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label={CONFIRM_COPY.private}>
            <h3 style={{ ...SECTION_LABEL, fontWeight: 400 }}>{CONFIRM_COPY.private}</h3>
            <p data-testid="confirm-private" style={{ ...ROW, ...text(textStep.meta, 400, t.text2), margin: 0 }}>
              {CONFIRM_COPY.privateRow}
            </p>
          </section>
        </>
      }
      footer={
        <>
          <span style={{ flexGrow: 1 }} />
          <RecipeButton small={!phone} phone={phone} data-testid="confirm-cancel" onClick={onCancel}>
            {CONFIRM_COPY.cancel}
          </RecipeButton>
          <RecipeButton
            small={!phone}
            phone={phone}
            variant="primary"
            data-testid="confirm-publish"
            onClick={() => {
              onCancel();
              onPublish();
            }}
          >
            {CONFIRM_COPY.publish}
          </RecipeButton>
        </>
      }
    />
  );
}
