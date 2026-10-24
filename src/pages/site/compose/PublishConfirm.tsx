/* CA-25 P2: the last look before Publish.

   A 480 window of the modal recipes: "Publish {title}?" (15/500), under it "Visible to anyone with the link." (12.5 `--text2`),
   then Public and Private (labels at 12 `--label`). A public row is 44 tall, split by a 1px `--hairline`: the name at 13 on the left,
   the value at 12.5 `--text2` at the right, cut to one line. What stays private is one line in `--text2`. Cancel and Publish below. */

import type { CSSProperties } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONFIRM_COPY, type ConfirmRow } from "@/lib/build/publishChecklist";
import { t } from "@/lib/theme/tokens";

import { ELLIPSIS, RecipeButton } from "./modalRecipes";
import { PublishFrame } from "./PublishChecklist";
import { text } from "./refinedStyles";

const LINE: CSSProperties = { ...text(12.5, 400, t.text2), margin: "4px 0 0" };
const SECTION_LABEL: CSSProperties = { ...text(12, 400, t.label), margin: "14px 0 4px" };
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
  return (
    <PublishFrame
      open={open}
      onClose={onCancel}
      title={CONFIRM_COPY.title(title)}
      width={480}
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
                  <span style={{ ...text(13, 400, t.text), flexShrink: 0 }}>{row.name}</span>
                  <span data-testid={`confirm-${row.key}-value`} title={row.value} style={{ ...text(12.5, 400, t.text2), ...ELLIPSIS, flexGrow: 1, textAlign: "right" }}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label={CONFIRM_COPY.private}>
            <h3 style={{ ...SECTION_LABEL, fontWeight: 400 }}>{CONFIRM_COPY.private}</h3>
            <p data-testid="confirm-private" style={{ ...ROW, ...text(12.5, 400, t.text2), margin: 0 }}>
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
