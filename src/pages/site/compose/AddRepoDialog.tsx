/* CA-15 P9: Add › "GitHub repository": a repository used in this build, owned by you or by a third party.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). Required:

   - Repository URL: `github.com/owner/name`, with or without `https://`.
   - Ownership: Created in this build, Your existing repository, or Third-party repository.

   Visible: Description (up to 500 characters). When a valid URL is entered the browser asks GitHub's public API about it, once per
   URL and unauthenticated, and shows what came back in a nested panel: Repository, Primary language, Licence ("<licence> ·
   reuse permitted" for the permissive ones, its name alone for any other, "No licence · reuse not granted" for none) and Last
   commit ("Possibly unmaintained" when it is over twelve months old). If GitHub cannot be reached, the panel says so and the tile
   is still valid with the URL alone.

   A third-party repository adds its Author (filled from the URL's owner, editable) and how it was Used. The maker's own
   repository adds Visibility, Generated with and a Deployed URL. Optional: Pinned version, Path, Modifications (third-party
   only), Key files and Run instructions. Run instructions name keys, never their values: a line that looks as if it holds one is
   refused before anything is stored. */

import { useEffect, useId, useState } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { RepoInput } from "@/lib/build/graph";
import {
  REPO_AUTHOR_MAX,
  REPO_DESCRIPTION_MAX,
  REPO_MODIFICATIONS_MAX,
  REPO_OWNERSHIPS,
  REPO_OWNERSHIP_LABEL,
  REPO_PATH_MAX,
  REPO_PIN_KINDS,
  REPO_PIN_LABEL,
  REPO_PIN_VALUE_MAX,
  REPO_USAGES,
  REPO_USAGE_LABEL,
  RUN_HINT,
  fetchRepoFacts,
  firstSecretLine,
  isPossiblyUnmaintained,
  licenceLine,
  parseRepoUrl,
  repoDay,
  type RepoFetched,
  type RepoOwnership,
  type RepoPinKind,
  type RepoUsage,
  type RepoVisibility,
} from "@/lib/build/sourceTiles";
import { linesOf } from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { ChoiceGrid } from "./ChoiceGrid";
import { Field } from "./composeControls";
import { FieldRow, FieldRows, Hint, ModalForm, ModalShell, SectionHeading, firstMissing } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, tnum, typedArea, typedField } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const REPO_DIALOG_COPY = {
  title: "Add a GitHub repository",
  subtitle: "A repository used in this build, owned by you or by a third party",
  url: "Repository URL",
  urlPlaceholder: "e.g. github.com/owner/name",
  ownership: "Ownership",
  description: "Description",
  descriptionPlaceholder: "e.g. The helpdesk router, as it was when this build was made",
  retrieved: "Retrieved from GitHub",
  reading: "Reading from GitHub",
  repository: "Repository",
  language: "Primary language",
  licence: "Licence",
  lastCommit: "Last commit",
  unmaintained: "Possibly unmaintained",
  unreachable: "Could not reach GitHub. Details can be added by hand.",
  thirdParty: "Third-party repository",
  author: "Author",
  authorLine: "Credited on the build page",
  usage: "Usage",
  visibility: "Visibility",
  public: "Public",
  private: "Private",
  generatedWith: "Generated with",
  selectTool: "Select a tool",
  deployed: "Deployed URL",
  deployedPlaceholder: "e.g. example.com",
  pinned: "Pinned version",
  pinnedLine: "The branch, tag or commit that was used",
  pinValue: "Pinned value",
  pinPlaceholder: "e.g. v1.4.2",
  path: "Path",
  pathLine: "The folder inside the repository that was used",
  pathPlaceholder: "e.g. packages/router",
  modifications: "Modifications",
  modificationsLine: "What was changed from the original",
  modificationsPlaceholder: "e.g. Replaced the Slack client with the email one",
  keyFiles: "Key files",
  keyFilesLine: "The files that matter most, one per line",
  keyFilesPlaceholder: "e.g. src/router.ts\nREADME.md",
  run: "Run instructions",
  runLine: "How to run it, one command per line",
  runPlaceholder: "e.g. npm install\nnpm run dev",
  runSecret: "A run instruction looks as if it holds a key's value. Name the key instead, for example GITHUB_TOKEN.",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddRepoInput = Omit<RepoInput, "session">;

export interface AddRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddRepoInput) => void;
  /** The tools the build already uses, first in the "Generated with" picker. */
  inBuild?: readonly string[];
  /** How a repository is looked up; GitHub's public API unless a test says otherwise. */
  fetchRepo?: (owner: string, name: string) => Promise<RepoFetched | null>;
}

type RetrievedState = { key: string; facts: RepoFetched | null } | null;

function Retrieved({ facts, owner, name, status }: { facts: RepoFetched | null; owner: string; name: string; status: "loading" | "done" }) {
  const rows: { label: string; value: React.ReactNode; testId: string }[] = [];
  if (status === "done" && facts) {
    const licence = licenceLine(facts.licenceSpdx, facts.licenceName);
    rows.push({ label: REPO_DIALOG_COPY.repository, value: `${owner}/${name}`, testId: "repo-name" });
    if (facts.language) rows.push({ label: REPO_DIALOG_COPY.language, value: facts.language, testId: "repo-language" });
    rows.push({
      label: REPO_DIALOG_COPY.licence,
      testId: "repo-licence",
      value: licence.reuse ? (
        <>
          {licence.text} · <span style={{ color: t.evidence }}>{licence.reuse}</span>
        </>
      ) : (
        licence.text
      ),
    });
    if (facts.pushedAt) {
      rows.push({
        label: REPO_DIALOG_COPY.lastCommit,
        testId: "repo-pushed",
        value: (
          <>
            <span style={tnum}>{repoDay(facts.pushedAt)}</span>
            {isPossiblyUnmaintained(facts.pushedAt) ? <span style={{ color: t.label }}> · {REPO_DIALOG_COPY.unmaintained}</span> : null}
          </>
        ),
      });
    }
  }
  return (
    <div role="group" aria-label={REPO_DIALOG_COPY.retrieved} data-testid="repo-retrieved" style={{ background: t.flat, border: `1px solid ${t.line}`, borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <SectionHeading>{REPO_DIALOG_COPY.retrieved}</SectionHeading>
      {status === "loading" ? (
        <span role="status" style={text(12.5, 400, t.label)}>
          {REPO_DIALOG_COPY.reading}
        </span>
      ) : !facts ? (
        <span role="status" data-testid="repo-unreachable" style={text(12.5, 400, t.text2)}>
          {REPO_DIALOG_COPY.unreachable}
        </span>
      ) : (
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 12, rowGap: 4 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: "contents" }}>
              <dt style={text(12.5, 400, t.text2)}>{row.label}</dt>
              <dd data-testid={row.testId} style={{ ...text(13, 400, t.text), margin: 0, overflowWrap: "anywhere" }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Form({ onAdd, onCancel, phone, inBuild = [], fetchRepo }: Pick<AddRepoDialogProps, "onAdd" | "inBuild"> & { fetchRepo: NonNullable<AddRepoDialogProps["fetchRepo"]>; onCancel: () => void; phone: boolean }) {
  const [url, setUrl] = useState("");
  const [ownership, setOwnership] = useState<RepoOwnership | null>(null);
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState<string | null>(null);
  const [usage, setUsage] = useState<RepoUsage[]>([]);
  const [visibility, setVisibility] = useState<RepoVisibility | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [deployed, setDeployed] = useState("");
  const [pinKind, setPinKind] = useState<RepoPinKind | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [path, setPath] = useState("");
  const [modifications, setModifications] = useState("");
  const [keyFiles, setKeyFiles] = useState("");
  const [run, setRun] = useState("");
  const [retrieved, setRetrieved] = useState<RetrievedState>(null);
  const [tried, setTried] = useState(false);
  const uid = useId();

  const parsed = parseRepoUrl(url);
  const key = parsed ? `${parsed.owner}/${parsed.name}`.toLowerCase() : null;

  /* Once per URL: the lookup starts when the address first reads as a repository, and a later change of address starts another. */
  useEffect(() => {
    if (!parsed) return;
    let live = true;
    void fetchRepo(parsed.owner, parsed.name).then((facts) => {
      if (live) setRetrieved({ key: `${parsed.owner}/${parsed.name}`.toLowerCase(), facts });
    });
    return () => {
      live = false;
    };
    // The address, not the parsed object, decides when to ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const third = ownership === "third_party";
  const own = ownership === "created" || ownership === "owned";
  const shownAuthor = author ?? parsed?.owner ?? "";
  const here = retrieved && retrieved.key === key ? retrieved : null;
  const runSecret = firstSecretLine(run);
  const missing = firstMissing([
    [parsed !== null, "a repository URL"],
    [ownership !== null, "an ownership"],
  ]);

  const submit = () => {
    setTried(true);
    if (!parsed || !ownership || runSecret) return;
    onAdd({
      url: parsed.url,
      ownership,
      ...(description.trim() ? { description: description.trim() } : null),
      ...(here?.facts ? { fetched: here.facts } : null),
      ...(third ? { author: shownAuthor.trim(), ...(usage.length ? { usage } : null), ...(modifications.trim() ? { modifications: modifications.trim() } : null) } : null),
      ...(own ? { ...(visibility ? { visibility } : null), ...(generated ? { generatedWith: generated } : null), ...(deployed.trim() ? { deployedUrl: deployed.trim() } : null) } : null),
      ...(pinKind && pinValue.trim() ? { pin: { kind: pinKind, value: pinValue.trim() } } : null),
      ...(path.trim() ? { path: path.trim() } : null),
      ...(linesOf(keyFiles).length ? { keyFiles: linesOf(keyFiles) } : null),
      ...(linesOf(run).length ? { run: linesOf(run) } : null),
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} alert={tried && runSecret ? REPO_DIALOG_COPY.runSecret : null}>
      <FieldRows>
        <FieldRow id={`${uid}-url`} label={REPO_DIALOG_COPY.url} phone={phone}>
          <input id={`${uid}-url`} type="text" inputMode="url" autoComplete="off" value={url} placeholder={REPO_DIALOG_COPY.urlPlaceholder} onChange={(event) => setUrl(event.target.value)} style={typedField(phone, { fontFamily: DM_MONO })} />
        </FieldRow>
        <FieldRow id={`${uid}-ownership`} label={REPO_DIALOG_COPY.ownership} group phone={phone}>
          <ChoiceGrid<RepoOwnership> bare label={REPO_DIALOG_COPY.ownership} items={REPO_OWNERSHIPS.map((value) => ({ value, label: REPO_OWNERSHIP_LABEL[value] }))} value={ownership} onChange={setOwnership} phone={phone} />
        </FieldRow>
      </FieldRows>

      <Field id={`${uid}-description`} label={REPO_DIALOG_COPY.description}>
        <textarea id={`${uid}-description`} rows={3} maxLength={REPO_DESCRIPTION_MAX} value={description} placeholder={REPO_DIALOG_COPY.descriptionPlaceholder} onChange={(event) => setDescription(event.target.value)} style={typedArea(phone)} />
        <span style={{ ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
          {description.length} / {REPO_DESCRIPTION_MAX}
        </span>
      </Field>

      {parsed ? <Retrieved facts={here?.facts ?? null} owner={parsed.owner} name={parsed.name} status={here ? "done" : "loading"} /> : null}

      {third ? (
        <>
          <SectionHeading>{REPO_DIALOG_COPY.thirdParty}</SectionHeading>
          <FieldRows>
            <FieldRow id={`${uid}-author`} label={REPO_DIALOG_COPY.author} phone={phone}>
              <input id={`${uid}-author`} type="text" maxLength={REPO_AUTHOR_MAX} value={shownAuthor} onChange={(event) => setAuthor(event.target.value)} style={typedField(phone)} />
              <Hint>{REPO_DIALOG_COPY.authorLine}</Hint>
            </FieldRow>
            <FieldRow id={`${uid}-usage`} label={REPO_DIALOG_COPY.usage} group phone={phone}>
              {REPO_USAGES.map((value) => (
                <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28 }}>
                  <Checkbox checked={usage.includes(value)} onChange={(event) => setUsage((now) => (event.target.checked ? [...now, value] : now.filter((one) => one !== value)))} />
                  <span style={text(13, 400, t.text)}>{REPO_USAGE_LABEL[value]}</span>
                </label>
              ))}
            </FieldRow>
          </FieldRows>
        </>
      ) : null}

      {own ? (
        <FieldRows>
          <FieldRow id={`${uid}-visibility`} label={REPO_DIALOG_COPY.visibility} group phone={phone}>
            <Segmented<RepoVisibility>
              label={REPO_DIALOG_COPY.visibility}
              semantics="radio"
              size={phone ? 50 : 30}
              fontSize={13}
              items={[{ value: "public", label: REPO_DIALOG_COPY.public }, { value: "private", label: REPO_DIALOG_COPY.private }]}
              value={visibility ?? ("" as RepoVisibility)}
              onChange={(next) => setVisibility((current) => (current === next ? null : next))}
            />
          </FieldRow>
          <FieldRow id={`${uid}-generated`} label={REPO_DIALOG_COPY.generatedWith} group phone={phone}>
            <div>
              <ToolPicker label={REPO_DIALOG_COPY.generatedWith} value={generated} onChange={setGenerated} inBuild={inBuild} allowNone phone={phone} step="code" placeholder={REPO_DIALOG_COPY.selectTool} />
            </div>
          </FieldRow>
          <FieldRow id={`${uid}-deployed`} label={REPO_DIALOG_COPY.deployed} phone={phone}>
            <input id={`${uid}-deployed`} type="text" inputMode="url" value={deployed} placeholder={REPO_DIALOG_COPY.deployedPlaceholder} onChange={(event) => setDeployed(event.target.value)} style={typedField(phone)} />
          </FieldRow>
        </FieldRows>
      ) : null}

      <OptionalSection>
        <OptionalField name={REPO_DIALOG_COPY.pinned} description={REPO_DIALOG_COPY.pinnedLine} summary={pinKind && pinValue.trim() ? `${REPO_PIN_LABEL[pinKind]} ${pinValue.trim()}` : null} phone={phone}>
          <ChoiceGrid<RepoPinKind> label={REPO_DIALOG_COPY.pinned} items={REPO_PIN_KINDS.map((value) => ({ value, label: REPO_PIN_LABEL[value] }))} value={pinKind} onChange={setPinKind} phone={phone} allowClear />
          {pinKind ? <input aria-label={REPO_DIALOG_COPY.pinValue} type="text" maxLength={REPO_PIN_VALUE_MAX} value={pinValue} placeholder={REPO_DIALOG_COPY.pinPlaceholder} onChange={(event) => setPinValue(event.target.value)} style={typedField(phone, { fontFamily: DM_MONO })} /> : null}
        </OptionalField>

        <OptionalField name={REPO_DIALOG_COPY.path} description={REPO_DIALOG_COPY.pathLine} summary={summaryOf(path)} phone={phone}>
          <input aria-label={REPO_DIALOG_COPY.path} type="text" maxLength={REPO_PATH_MAX} value={path} placeholder={REPO_DIALOG_COPY.pathPlaceholder} onChange={(event) => setPath(event.target.value)} style={typedField(phone, { fontFamily: DM_MONO })} />
        </OptionalField>

        {third ? (
          <OptionalField name={REPO_DIALOG_COPY.modifications} description={REPO_DIALOG_COPY.modificationsLine} summary={summaryOf(modifications)} phone={phone}>
            <textarea aria-label={REPO_DIALOG_COPY.modifications} rows={3} maxLength={REPO_MODIFICATIONS_MAX} value={modifications} placeholder={REPO_DIALOG_COPY.modificationsPlaceholder} onChange={(event) => setModifications(event.target.value)} style={typedArea(phone)} />
          </OptionalField>
        ) : null}

        <OptionalField name={REPO_DIALOG_COPY.keyFiles} description={REPO_DIALOG_COPY.keyFilesLine} summary={summaryOf(linesOf(keyFiles))} phone={phone}>
          <textarea aria-label={REPO_DIALOG_COPY.keyFiles} rows={3} value={keyFiles} placeholder={REPO_DIALOG_COPY.keyFilesPlaceholder} onChange={(event) => setKeyFiles(event.target.value)} style={typedArea(phone, { fontFamily: DM_MONO })} />
        </OptionalField>

        <OptionalField name={REPO_DIALOG_COPY.run} description={REPO_DIALOG_COPY.runLine} summary={summaryOf(linesOf(run))} forceOpen={tried && Boolean(runSecret)} phone={phone}>
          <textarea aria-label={REPO_DIALOG_COPY.run} rows={4} value={run} placeholder={REPO_DIALOG_COPY.runPlaceholder} onChange={(event) => setRun(event.target.value)} style={typedArea(phone, { fontFamily: DM_MONO })} />
          <Hint>{RUN_HINT}</Hint>
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddRepoDialog({ open, onOpenChange, onAdd, inBuild, fetchRepo }: AddRepoDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddRepoInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={REPO_DIALOG_COPY.title} subtitle={REPO_DIALOG_COPY.subtitle} width={520} testId="add-repo-dialog">
      <Form onAdd={add} onCancel={close} phone={phone} inBuild={inBuild} fetchRepo={fetchRepo ?? fetchRepoFacts} />
    </ModalShell>
  );
}

export default AddRepoDialog;
