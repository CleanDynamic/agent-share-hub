/* CA-15 P9, CA-15b P2: Add › "GitHub repository": a repository used in this build, owned by you or by a third party.

   Built from `modalRecipes` as the board "Add a GitHub repository" draws it, 560 wide (a `BottomSheet` below 768): the URL
   row, the facts panel retrieved from GitHub with its note, Ownership, Description, then for a third-party repository a
   group heading with Author and Usage ("Select all that apply"). Required:

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

import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { Block, BlockHead, FactList, FactRow, FieldArea, FieldInput, GroupHeading, Hint, MODAL_WIDTH, OptionGrid, Panel, Row, SegmentedField, StatusLine } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { ToolPicker } from "./ToolPicker";

export const REPO_DIALOG_COPY = {
  title: "Add a GitHub repository",
  subtitle: "Repository used in this build",
  url: "Repository URL",
  urlPlaceholder: "github.com/owner/name",
  ownership: "Ownership",
  description: "Description",
  descriptionPlaceholder: "Rich text editor the composer is built on",
  retrievedNote: "From GitHub. No recent commits: flagged as possibly unmaintained",
  retrieved: "Retrieved from GitHub",
  reading: "Reading from GitHub",
  repository: "Repository",
  language: "Primary language",
  licence: "Licence",
  lastCommit: "Last commit",
  unmaintained: "Possibly unmaintained",
  unreachable: "GitHub unreachable. Fields stay editable.",
  thirdParty: "Third-party repository",
  author: "Author",
  usage: "Usage",
  visibility: "Visibility",
  public: "Public",
  private: "Private",
  generatedWith: "Generated with",
  selectTool: "Select a tool",
  deployed: "Deployed URL",
  deployedPlaceholder: "example.com",
  pinned: "Pinned version",
  pinnedLine: "Branch, tag or commit",
  pinValue: "Pinned value",
  pinPlaceholder: "v2.10.0",
  path: "Path",
  pathLine: "Folder or file, if only part was used",
  pathPlaceholder: "packages/extension-underline",
  modifications: "Modifications",
  modificationsLine: "Changes from the original",
  modificationsPlaceholder: "None",
  keyFiles: "Key files",
  keyFilesLine: "README, CLAUDE.md, agent configuration, skills folder",
  keyFilesPlaceholder: "One path per line",
  run: "Run instructions",
  runLine: "Clone, dependencies, start command, environment variable names",
  runPlaceholder: "One per line. Key names only",
  runSecret: "Contains a key value. Key names only, like GITHUB_TOKEN",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddRepoInput = Omit<RepoInput, "session">;

/** CA-18: what the form starts with on a repository that is there. */
export interface RepoCurrent {
  url: string;
  ownership: RepoOwnership | null;
  description: string;
  author: string;
  usage: RepoUsage[];
  visibility: RepoVisibility | null;
  generated: string | null;
  deployed: string;
  pinKind: RepoPinKind | null;
  pinValue: string;
  path: string;
  modifications: string;
  keyFiles: string[];
  run: string[];
  /** What GitHub said when the address was entered; kept, never asked for again. */
  fetched: RepoFetched | null;
}

export interface AddRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddRepoInput) => void;
  current?: RepoCurrent | null;
  edit?: EditMode<AddRepoInput>;
  /** The tools the build already uses, first in the "Generated with" picker. */
  inBuild?: readonly string[];
  /** How a repository is looked up; GitHub's public API unless a test says otherwise. */
  fetchRepo?: (owner: string, name: string) => Promise<RepoFetched | null>;
}

type RetrievedState = { key: string; facts: RepoFetched | null } | null;

function Retrieved({ facts, owner, name, status }: { facts: RepoFetched | null; owner: string; name: string; status: "loading" | "done" }) {
  if (status === "loading") return <StatusLine>{REPO_DIALOG_COPY.reading}</StatusLine>;
  if (!facts)
    return (
      <span data-testid="repo-unreachable">
        <StatusLine>{REPO_DIALOG_COPY.unreachable}</StatusLine>
      </span>
    );
  const licence = licenceLine(facts.licenceSpdx, facts.licenceName);
  return (
    <Panel label={REPO_DIALOG_COPY.retrieved} testId="repo-retrieved">
      <FactList>
        <FactRow label={REPO_DIALOG_COPY.repository} first testId="repo-name">{`${owner}/${name}`}</FactRow>
        {facts.language ? (
          <FactRow label={REPO_DIALOG_COPY.language} testId="repo-language">
            {facts.language}
          </FactRow>
        ) : null}
        <FactRow label={REPO_DIALOG_COPY.licence} testId="repo-licence">
          {licence.reuse ? `${licence.text} · ${licence.reuse}` : licence.text}
        </FactRow>
        {facts.pushedAt ? (
          <FactRow label={REPO_DIALOG_COPY.lastCommit} testId="repo-pushed">
            {`${repoDay(facts.pushedAt)}${isPossiblyUnmaintained(facts.pushedAt) ? ` · ${REPO_DIALOG_COPY.unmaintained}` : ""}`}
          </FactRow>
        ) : null}
      </FactList>
    </Panel>
  );
}

/** Whether the lookup for this address is already held. */
const here0 = (retrieved: RetrievedState, key: string | null): boolean => retrieved !== null && retrieved.key === key;

function Form({ onAdd, onCancel, phone, inBuild = [], fetchRepo, current, edit }: Pick<AddRepoDialogProps, "onAdd" | "inBuild" | "current" | "edit"> & { fetchRepo: NonNullable<AddRepoDialogProps["fetchRepo"]>; onCancel: () => void; phone: boolean }) {
  const [url, setUrl] = useState(current?.url ?? "");
  const [ownership, setOwnership] = useState<RepoOwnership | null>(current?.ownership ?? null);
  const [description, setDescription] = useState(current?.description ?? "");
  const [author, setAuthor] = useState<string | null>(current ? current.author : null);
  const [usage, setUsage] = useState<RepoUsage[]>(current?.usage ?? []);
  const [visibility, setVisibility] = useState<RepoVisibility | null>(current?.visibility ?? null);
  const [generated, setGenerated] = useState<string | null>(current?.generated ?? null);
  const [deployed, setDeployed] = useState(current?.deployed ?? "");
  const [pinKind, setPinKind] = useState<RepoPinKind | null>(current?.pinKind ?? null);
  const [pinValue, setPinValue] = useState(current?.pinValue ?? "");
  const [path, setPath] = useState(current?.path ?? "");
  const [modifications, setModifications] = useState(current?.modifications ?? "");
  const [keyFiles, setKeyFiles] = useState((current?.keyFiles ?? []).join("\n"));
  const [run, setRun] = useState((current?.run ?? []).join("\n"));
  const [retrieved, setRetrieved] = useState<RetrievedState>(() => {
    const seeded = current ? parseRepoUrl(current.url) : null;
    return seeded && current?.fetched ? { key: `${seeded.owner}/${seeded.name}`.toLowerCase(), facts: current.fetched } : null;
  });
  const [tried, setTried] = useState(false);
  const uid = useId();

  const parsed = parseRepoUrl(url);
  const key = parsed ? `${parsed.owner}/${parsed.name}`.toLowerCase() : null;

  /* Once per URL: the lookup starts when the address first reads as a repository, and a later change of address starts another. */
  useEffect(() => {
    // A repository that is there keeps what GitHub said when it was added.
    if (!parsed || (edit && here0(retrieved, key))) return;
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
  const missing = missingLabels([
    [parsed !== null, "Repository URL"],
    [ownership !== null, "Ownership"],
  ]);

  const submit = () => {
    setTried(true);
    if (!parsed || !ownership || runSecret) return;
    (edit ? edit.onSave : (onAdd ?? (() => undefined)))({
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
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} addLabel={edit ? MODAL_COPY.save : undefined} alert={tried && runSecret ? REPO_DIALOG_COPY.runSecret : null}>
      {edit?.before ? edit.before({ url } as AddRepoInput) : null}
      <Row id={`${uid}-url`} label={REPO_DIALOG_COPY.url} phone={phone}>
        <FieldInput phone={phone} mono id={`${uid}-url`} inputMode="url" autoComplete="off" value={url} placeholder={REPO_DIALOG_COPY.urlPlaceholder} onChange={(event) => setUrl(event.target.value)} />
      </Row>

      <Block>
        {parsed ? <Retrieved facts={here?.facts ?? null} owner={parsed.owner} name={parsed.name} status={here ? "done" : "loading"} /> : null}
        <Hint>{REPO_DIALOG_COPY.retrievedNote}</Hint>
      </Block>

      <Block label={REPO_DIALOG_COPY.ownership}>
        <BlockHead label={REPO_DIALOG_COPY.ownership} />
        <SegmentedField<RepoOwnership> label={REPO_DIALOG_COPY.ownership} phone={phone} items={REPO_OWNERSHIPS.map((value) => ({ value, label: REPO_OWNERSHIP_LABEL[value] }))} value={ownership} onChange={setOwnership} />
      </Block>

      <Block>
        <BlockHead label={REPO_DIALOG_COPY.description} htmlFor={`${uid}-description`} count={`${description.length} / ${REPO_DESCRIPTION_MAX}`} />
        <FieldArea phone={phone} id={`${uid}-description`} rows={3} maxLength={REPO_DESCRIPTION_MAX} value={description} placeholder={REPO_DIALOG_COPY.descriptionPlaceholder} onChange={(event) => setDescription(event.target.value)} />
      </Block>

      {third ? (
        <>
          <GroupHeading>{REPO_DIALOG_COPY.thirdParty}</GroupHeading>
          <Row id={`${uid}-author`} label={REPO_DIALOG_COPY.author} noRule phone={phone}>
            <FieldInput phone={phone} id={`${uid}-author`} maxLength={REPO_AUTHOR_MAX} value={shownAuthor} onChange={(event) => setAuthor(event.target.value)} />
          </Row>
          <Block>
            <BlockHead label={REPO_DIALOG_COPY.usage} />
            <OptionGrid<RepoUsage>
              label={REPO_DIALOG_COPY.usage}
              phone={phone}
              multiple
              items={REPO_USAGES.map((value) => ({ value, label: REPO_USAGE_LABEL[value] }))}
              chosen={usage}
              onPick={(value) => setUsage((now) => (now.includes(value) ? now.filter((one) => one !== value) : [...now, value]))}
            />
          </Block>
        </>
      ) : null}

      {own ? (
        <>
          <Row id={`${uid}-visibility`} label={REPO_DIALOG_COPY.visibility} group phone={phone}>
            <SegmentedField<RepoVisibility>
              label={REPO_DIALOG_COPY.visibility}
              phone={phone}
              items={[{ value: "public", label: REPO_DIALOG_COPY.public }, { value: "private", label: REPO_DIALOG_COPY.private }]}
              value={visibility}
              onChange={(next) => setVisibility((current) => (current === next ? null : next))}
            />
          </Row>
          <Row id={`${uid}-generated`} label={REPO_DIALOG_COPY.generatedWith} group phone={phone}>
            <ToolPicker label={REPO_DIALOG_COPY.generatedWith} value={generated} onChange={setGenerated} inBuild={inBuild} allowNone unpicked={generated === null} phone={phone} step="code" placeholder={REPO_DIALOG_COPY.selectTool} field />
          </Row>
          <Row id={`${uid}-deployed`} label={REPO_DIALOG_COPY.deployed} phone={phone}>
            <FieldInput phone={phone} mono id={`${uid}-deployed`} inputMode="url" value={deployed} placeholder={REPO_DIALOG_COPY.deployedPlaceholder} onChange={(event) => setDeployed(event.target.value)} />
          </Row>
        </>
      ) : null}

      <OptionalSection>
        <OptionalField name={REPO_DIALOG_COPY.pinned} description={REPO_DIALOG_COPY.pinnedLine} summary={pinKind && pinValue.trim() ? `${REPO_PIN_LABEL[pinKind]} ${pinValue.trim()}` : null} phone={phone}>
          <SegmentedField<RepoPinKind> label={REPO_DIALOG_COPY.pinned} phone={phone} items={REPO_PIN_KINDS.map((value) => ({ value, label: REPO_PIN_LABEL[value] }))} value={pinKind} onChange={(next) => setPinKind((current) => (current === next ? null : next))} />
          {pinKind ? <FieldInput phone={phone} mono aria-label={REPO_DIALOG_COPY.pinValue} maxLength={REPO_PIN_VALUE_MAX} value={pinValue} placeholder={REPO_DIALOG_COPY.pinPlaceholder} onChange={(event) => setPinValue(event.target.value)} /> : null}
        </OptionalField>

        <OptionalField name={REPO_DIALOG_COPY.path} description={REPO_DIALOG_COPY.pathLine} summary={summaryOf(path)} phone={phone}>
          <FieldInput phone={phone} mono aria-label={REPO_DIALOG_COPY.path} maxLength={REPO_PATH_MAX} value={path} placeholder={REPO_DIALOG_COPY.pathPlaceholder} onChange={(event) => setPath(event.target.value)} />
        </OptionalField>

        {third ? (
          <OptionalField name={REPO_DIALOG_COPY.modifications} description={REPO_DIALOG_COPY.modificationsLine} summary={summaryOf(modifications)} phone={phone}>
            <FieldInput phone={phone} aria-label={REPO_DIALOG_COPY.modifications} maxLength={REPO_MODIFICATIONS_MAX} value={modifications} placeholder={REPO_DIALOG_COPY.modificationsPlaceholder} onChange={(event) => setModifications(event.target.value)} />
          </OptionalField>
        ) : null}

        <OptionalField name={REPO_DIALOG_COPY.keyFiles} description={REPO_DIALOG_COPY.keyFilesLine} summary={summaryOf(linesOf(keyFiles))} phone={phone}>
          <FieldArea phone={phone} rows={2} mono aria-label={REPO_DIALOG_COPY.keyFiles} value={keyFiles} placeholder={REPO_DIALOG_COPY.keyFilesPlaceholder} onChange={(event) => setKeyFiles(event.target.value)} />
        </OptionalField>

        <OptionalField name={REPO_DIALOG_COPY.run} description={REPO_DIALOG_COPY.runLine} summary={summaryOf(linesOf(run))} forceOpen={tried && Boolean(runSecret)} phone={phone}>
          <FieldArea phone={phone} rows={3} mono aria-label={REPO_DIALOG_COPY.run} value={run} placeholder={REPO_DIALOG_COPY.runPlaceholder} onChange={(event) => setRun(event.target.value)} />
          <Hint>{RUN_HINT}</Hint>
        </OptionalField>
      </OptionalSection>
      {edit?.after ? edit.after({ url } as AddRepoInput) : null}
    </ModalForm>
  );
}

export function AddRepoDialog({ open, onOpenChange, onAdd, inBuild, fetchRepo, current, edit }: AddRepoDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddRepoInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : REPO_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={REPO_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-repo-dialog" : "add-repo-dialog"}>
      <Form onAdd={add} onCancel={close} phone={phone} inBuild={inBuild} fetchRepo={fetchRepo ?? fetchRepoFacts} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} />
    </ModalShell>
  );
}

export default AddRepoDialog;
