/* Start a build on a phone (mobile prompt 25, Part C): below 768 only. The five ways in, stacked as Panel modules in the
   desktop's order: paste a transcript, drop a file (a phone cannot drop, so it says what the file is and opens the picker),
   a repository URL, a Build File, then "Start empty instead". Everything they do is `ComposeNew`'s: this draws the offer and
   hands back what was chosen, so the reads, the busy guard and the errors are the page's own. */

import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { BigButton } from "@/components/phone/BigButton";
import { PhoneModule } from "@/components/phone/PhoneModule";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { BUILD_FILE_EXTENSIONS } from "@/components/compose/useBuildFileDrop";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export interface StartPhoneProps {
  /** What the connector left waiting, drawn by the page above the ways in. */
  waiting: ReactNode;
  busy: boolean;
  isStarting: boolean;
  text: string;
  onText: (text: string) => void;
  onReadPasted: () => void;
  repoUrl: string;
  onRepoUrl: (url: string) => void;
  onReadRepo: () => void;
  onFile: (file: File) => void;
  onBuildFile: (file: File) => void;
  onStartEmpty: () => void;
  error: string | null;
}

const heading: React.CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text };
const fact: React.CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label };

function UnderlinedLink({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{ minHeight: TOUCH_MIN, padding: "0 8px", border: 0, background: "transparent", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, cursor: disabled ? "wait" : "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

export function StartPhone({ waiting, busy, isStarting, text, onText, onReadPasted, repoUrl, onRepoUrl, onReadRepo, onFile, onBuildFile, onStartEmpty, error }: StartPhoneProps) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const buildFileInput = useRef<HTMLInputElement | null>(null);
  return (
    <div data-testid="start-phone" style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 8, padding: `8px ${PHONE_MARGIN}px 0` }}>
        <h1 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 24, fontWeight: 600, lineHeight: "28px", letterSpacing: "-0.02em", color: t.text }}>Start a build</h1>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>It arrives already structured, so you see what it found before anything is saved.</p>
      </header>

      <div style={{ padding: `0 ${PHONE_MARGIN}px` }}>{waiting}</div>

      <PhoneModule>
        <label htmlFor="intake-transcript" style={heading}>
          Paste a transcript
        </label>
        <textarea
          id="intake-transcript"
          value={text}
          onChange={(event) => onText(event.target.value)}
          disabled={busy}
          spellCheck={false}
          style={{ width: "100%", boxSizing: "border-box", height: 160, resize: "none", fontFamily: DM_MONO, fontSize: 13, lineHeight: "18px", color: t.text, background: t.field, border: 0, borderRadius: 12, padding: 12 }}
        />
        <div>
          <Button variant="primary" size={44} onClick={onReadPasted} disabled={busy}>
            Read it
          </Button>
        </div>
      </PhoneModule>

      <PhoneModule>
        <h2 style={heading}>Drop a file</h2>
        <p style={fact}>A chat export, .json or .zip</p>
        <BigButton onClick={() => fileInput.current?.click()} disabled={busy} style={{ alignSelf: "flex-start" }}>
          Choose a file
        </BigButton>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.markdown,.text,.json,.zip,text/plain,text/markdown,application/json,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice fires change again.
            event.target.value = "";
            if (file) onFile(file);
          }}
          style={{ display: "none" }}
        />
      </PhoneModule>

      <PhoneModule>
        <label htmlFor="intake-repo-url" style={heading}>
          Or paste a repository URL
        </label>
        <input
          id="intake-repo-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={repoUrl}
          onChange={(event) => onRepoUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (!busy) onReadRepo();
          }}
          disabled={busy}
          style={{ boxSizing: "border-box", width: "100%", height: 44, fontFamily: FIGTREE, fontSize: 16, color: t.text, background: t.field, border: 0, borderRadius: 22, padding: "0 16px" }}
        />
        <p style={fact}>Public GitHub repositories only. Nothing is cloned. The manifests, the README and one entrypoint file are read, and everything found is a suggestion you confirm.</p>
        <div>
          <Button variant="primary" size={44} aria-label="Read it, repository URL" onClick={onReadRepo} disabled={busy}>
            Read it
          </Button>
        </div>
      </PhoneModule>

      <PhoneModule>
        <div data-visual-slot="intake-build-file" data-testid="import-drop" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={heading}>Or drop a Build File</h2>
          <p style={fact}>{`The file the AI wrote up for you (${BUILD_FILE_EXTENSIONS.join(", ")}).`}</p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <BigButton data-testid="import-choose-build-file" onClick={() => buildFileInput.current?.click()} disabled={busy}>
              Choose a Build File
            </BigButton>
            <Link to="/import" style={{ display: "inline-flex", alignItems: "center", minHeight: TOUCH_MIN, fontFamily: FIGTREE, fontSize: 15, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap" }}>
              Get the Extractor
            </Link>
          </div>
        </div>
        <input
          ref={buildFileInput}
          type="file"
          accept={BUILD_FILE_EXTENSIONS.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onBuildFile(file);
          }}
          style={{ display: "none" }}
        />
      </PhoneModule>

      {error ? (
        <p role="alert" style={{ margin: `0 ${PHONE_MARGIN}px`, padding: "12px 16px", borderRadius: 12, background: t.breakageFill, color: t.text, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <UnderlinedLink onClick={onStartEmpty} disabled={busy}>
          {isStarting ? "Creating a draft…" : "Start empty instead"}
        </UnderlinedLink>
      </div>
    </div>
  );
}

export default StartPhone;
