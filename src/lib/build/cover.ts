// cover: the one media row that stands for a build on a card.
//
// THE PROBLEM THIS SOLVES
// A card has to show something. Until now the only pointer a build carried was
// hero_node_id, which names a NODE rather than a picture, so getting an image
// out of it meant chasing that node's payload — and a build whose hero is a
// live_app, or which has no hero at all, produced nothing. Meanwhile the
// gallery had grown its own answer in src/components/gallery/cardMedia.ts and
// the build page had a third in src/pages/BuildPage.tsx.
//
// So there is one chain, here, and it is total: every step falls through to the
// next, and the last one is honest about returning nothing.
//
//   1. cover_media_id        the creator said which image. Nothing overrides it.
//   2. the hero node's media  what BuildPage has resolved since NS-P04.
//   3. the first evidence     screenshots and results are the pictures a build
//      node's media           already has, in the creator's own tree order.
//   4. null                   a build genuinely carrying no image. Cards lead
//                             with the outcome, set large; that is a designed
//                             branch, not a failure.
//
// WHY IT IS PURE, AND TAKES ITS INPUTS AS ARGUMENTS
// resolveCover queries nothing. Its caller has the build record and the media
// list already — BuildPage loads both, compose holds both in its workspace —
// and a resolver that fetched would be a resolver that cannot be tested and
// that turns a grid of cards back into a query per card. That discipline is
// what the rest of src/lib/build/ is built on and this file does not break it.

import { supabase } from "@/integrations/supabase/client";
import { updateBuild } from "./builds";
import { MEDIA_COLUMNS } from "./media";
import { buildLayerError, type Build, type BuildMedia, type BuildNode } from "./types";

/**
 * The node types in the registry's `evidence` category.
 *
 * A constant rather than a lookup because resolveCover is pure: it is handed a
 * tree and a media list, not the node_types registry, and a resolver that took
 * the registry too would be a resolver no card body could call cheaply.
 *
 * These five ARE the evidence category as node_types is seeded (NS-P02) and
 * must be kept in step with it. A type added to that category and not to this
 * list costs a build its automatic cover; it costs nothing else.
 *
 * The order here is deliberately NOT a preference order — unlike EVIDENCE_TYPES
 * in src/components/gallery/cardMedia.ts, which ranks screenshots above eval
 * runs because a card wants the most pictorial thing. This is a membership set,
 * and the chain below walks the TREE in the creator's own order. The creator
 * put their best evidence first; that is a better signal than a fixed ranking.
 */
export const EVIDENCE_NODE_TYPES: ReadonlySet<string> = new Set([
  "comparison_table",
  "eval_run",
  "recording",
  "result",
  "screenshot",
]);

/** The header fields the chain reads. Any build row satisfies this. */
export type CoverSource = Pick<Build, "cover_media_id" | "hero_node_id">;

/**
 * The node fields the chain reads, nested if the caller has a nested tree.
 *
 * Deliberately narrower than BuildNode. The build page hands this a NodeTree;
 * the gallery card (NS-P31) hands it the flat, position-ordered node window
 * that came back on the card query, which carries no children and only the
 * columns a card body reads. Asking for a whole BuildNode would have made the
 * gallery cast, and a cast is how two surfaces start disagreeing about which
 * image a build leads with.
 */
export type CoverNode = Pick<BuildNode, "id" | "type" | "payload" | "is_gap"> & {
  readonly children?: readonly CoverNode[];
};

/**
 * The media fields the chain reads. Any build_media row satisfies this, as
 * does the gallery's narrower embedded row.
 *
 * post_position is OPTIONAL, and that is load-bearing rather than lax. The
 * gallery embeds a narrow column list that does not include it (BG-P09 changes
 * that; this prompt changes no component), so requiring it would break every
 * existing caller the moment the chain learned to read it. Absent simply means
 * "this caller did not ask about the set", which the chain treats identically
 * to "this build has no set" — it falls through to the links that were already
 * there and returns exactly what it returns today.
 */
export type CoverMedia = Pick<BuildMedia, "id" | "node_id"> &
  Partial<Pick<BuildMedia, "post_position">>;

/**
 * The media id a node points at, or null.
 *
 * media_id is the field key every type carrying one media reference declares.
 * generated_media instead holds a list of variants, and the one that speaks
 * for the node is the chosen one — falling back to the first, so a node whose
 * creator has not chosen yet still has a hero candidate.
 *
 * MOVED HERE FROM src/components/build/MediaFigure.tsx, unchanged, because the
 * build page and the cover chain were about to read a payload the same way in
 * two places. It is payload reading with no React in it, so the data layer is
 * where it belongs; BuildPage now imports it from here. MediaFigure keeps its
 * own copy for the compose frame until NS-P28 touches that file.
 */
export function nodeMediaId(
  node: Pick<BuildNode, "payload"> | null | undefined
): string | null {
  const payload =
    node?.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
      ? (node.payload as Record<string, unknown>)
      : null;
  if (!payload) return null;

  const direct = payload.media_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const variants = payload.variants;
  if (Array.isArray(variants)) {
    const records = variants.filter(
      (variant): variant is Record<string, unknown> =>
        Boolean(variant) && typeof variant === "object" && !Array.isArray(variant)
    );
    const chosen = records.find((variant) => variant.chosen === true) ?? records[0];
    const id = chosen?.media_id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }

  return null;
}

/**
 * Every placed node, depth first, in the order the tree renders.
 *
 * Depth first rather than level order because that IS reading order: a
 * screenshot nested under the first step comes before the second step, exactly
 * as it does on the page. The tray is absent by construction — it is not part
 * of the tree — which is right: nothing unplaced should become a build's cover.
 */
function flatten(tree: readonly CoverNode[]): CoverNode[] {
  const out: CoverNode[] = [];
  const walk = (nodes: readonly CoverNode[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/** One media row by id, out of the list already loaded. */
function byId<M extends CoverMedia>(media: readonly M[], id: string | null): M | null {
  if (!id) return null;
  return media.find((row) => row.id === id) ?? null;
}

/**
 * The image that stands for this build, or null if it has none.
 *
 * Each step is skipped, not failed, when the row it names has gone: a
 * cover_media_id whose media was deleted falls through to the hero rather than
 * blanking the card. The database does clear that pointer — the FK is ON DELETE
 * SET NULL — but a caller can be holding a build row read before the delete,
 * and a card that renders nothing because of a race is worse than one that
 * shows the next-best thing.
 *
 * BG-P07b PUT A STEP IN FRONT: the post's set, whose first entry is what the
 * creator most recently said this post leads with. It changes no answer today,
 * on purpose. builds.cover_media_id is maintained as a MIRROR of that same
 * position-0 row by a database trigger, so for any build with a set the two
 * steps name the same media, and for any build without one the set is empty and
 * step 1 answers as it always has. The step earns its place when a caller
 * starts selecting post_position: it reads the set from rows it already has in
 * hand rather than from a column that is a copy, and it is the link that keeps
 * working if the mirror is ever retired.
 */
export function resolveCover<M extends CoverMedia>(
  build: CoverSource | null | undefined,
  tree: readonly CoverNode[],
  media: readonly M[]
): M | null {
  if (!build) return null;

  // 0. The post's set, first entry. Only rows whose caller selected
  //    post_position can match; see the note on CoverMedia.
  const first = media.find((row) => row.post_position === 0);
  if (first) return first;

  // 1. The creator's explicit choice — and, for a build with a set, the mirror
  //    of the row step 0 just looked for.
  const chosen = byId(media, build.cover_media_id);
  if (chosen) return chosen;

  const nodes = flatten(tree);

  // 2. The hero node's media, resolved exactly as BuildPage resolves it:
  //    through the node's PAYLOAD. A hero whose media is attached by node_id
  //    alone is not a hero the page renders either, so this agrees with what a
  //    reader already sees rather than inventing a fourth answer.
  if (build.hero_node_id) {
    const hero = nodes.find((node) => node.id === build.hero_node_id);
    const heroMedia = byId(media, nodeMediaId(hero));
    if (heroMedia) return heroMedia;
  }

  // 3. The first evidence node carrying an image, in tree order.
  //
  //    Attached rows first, then the payload reference — both attachment paths
  //    exist in the record, and cardMedia.evidenceMedia already reads them in
  //    this order. A cover that disagreed with the card the gallery renders
  //    would be a bug the moment a compose preview showed it.
  //
  //    A gap is the creator saying "this part is missing". It is never a cover:
  //    that would put an admitted hole on the card as if it were the work.
  for (const node of nodes) {
    if (node.is_gap || !EVIDENCE_NODE_TYPES.has(node.type)) continue;

    const attached = media.find((row) => row.node_id === node.id);
    if (attached) return attached;

    const referenced = byId(media, nodeMediaId(node));
    if (referenced) return referenced;
  }

  // 4. Nothing. The card leads with the outcome.
  return null;
}

/**
 * Set or clear the build's cover.
 *
 * Passing null is not an error state — it is how a creator says "go back to
 * whatever the chain picks", which is the state every build starts in.
 *
 * No check that the media belongs to this build: the write goes through the
 * same RLS as any other header edit, and a cover pointing at another build's
 * object is unreadable anyway, because the storage policies gate an object on
 * the build id in its path prefix. Adding a verifying read here would cost a
 * round trip on every save to prevent a state that already renders as nothing.
 */
export async function setCover(
  buildId: string,
  mediaId: string | null
): Promise<Build> {
  return updateBuild(buildId, { cover_media_id: mediaId });
}

// =============================================================================
// The post's ordered cover set (BG-P07b)
// =============================================================================
// Everything above this line answers "which ONE picture stands for this build".
// Everything below answers the question that replaces it: "which pictures, in
// which order, does this post lead with". A post shows up to four, at their own
// aspect ratios, arranged by the creator.
//
// WHY THIS LIVES IN cover.ts AND NOT A NEW MODULE
// The set and the single cover are one subject, not two. builds.cover_media_id
// is now a MIRROR of the set's first entry — maintained by a database trigger,
// documented in 20260911120000_build_post_media.sql — and resolveCover reads
// both. Splitting them across two files would put an invariant on one side of a
// module boundary and the code that depends on it on the other, which is how
// the gallery, the build page and the compose surface ended up with three
// different answers to the cover question before NS-P27 collapsed them here.
//
// THE SET IS THE SOURCE OF TRUTH. cover_media_id is derived. Write to the set.

/** Four. The card's media block has four arrangements and no fifth. */
export const MAX_POST_MEDIA = 4;

/**
 * The longest an entry's text may be: 280 characters, the length of a tweet.
 *
 * Exported so the composer (BG-P23) counts against the same number the database
 * enforces. A second copy of 280 in a character counter is how an input starts
 * accepting a sentence the CHECK then refuses, and the creator loses the text
 * they just typed to an error they cannot act on.
 *
 * CHARACTERS, NOT UTF-16 UNITS. The constraint is char_length(post_text) <= 280,
 * which counts code points, so an emoji costs one of a creator's 280 rather than
 * the two that `"🛠".length` reports. Everything here measures the same way —
 * see the spread in setPostMediaText — so a refusal on this side and a refusal
 * in Postgres always agree about what fits.
 */
export const POST_TEXT_MAX = 280;

/**
 * build_media's columns plus the two this feature adds.
 *
 * Named rather than `*` — and built from MEDIA_COLUMNS rather than restating
 * it, so a column added to the media module cannot go missing here.
 */
export const POST_MEDIA_COLUMNS = `${MEDIA_COLUMNS}, post_position, post_text`;

/** Why a post-media write was refused, for a caller that must tell them apart. */
export type PostMediaErrorCode =
  /** More than MAX_POST_MEDIA were offered at once. */
  | "too_many"
  /** The set is already full, so there is no free position to append at. */
  | "full"
  /** The same media id appeared twice, which would claim one slot twice. */
  | "duplicate"
  /** The text was longer than POST_TEXT_MAX characters. */
  | "text_too_long"
  /** Text was written to a row that is not one of the post's entries. */
  | "not_in_post";

/**
 * A refusal that is about the SET's rules, not about the request failing.
 *
 * Separate from buildLayerError because the composer (BG-P23) has to react
 * differently: "full" is a sentence to show next to a disabled button, while a
 * network failure is a retry. Discriminating on a message string is how that
 * distinction rots, so the code is a field.
 */
export class PostMediaError extends Error {
  readonly code: PostMediaErrorCode;

  constructor(code: PostMediaErrorCode, message: string) {
    super(message);
    this.name = "PostMediaError";
    this.code = code;
  }
}

/**
 * The post's pictures, in the creator's order.
 *
 * Empty is the normal answer, not a failure: only builds whose creator has
 * arranged a set have one, and every other build renders from resolveCover's
 * existing chain exactly as it did before this column existed.
 *
 * The .limit is MAX_POST_MEDIA rather than a round number because that IS the
 * ceiling — the partial unique index and the 0..3 CHECK make more than four
 * rows unrepresentable, so a fifth row coming back would be a corrupted table
 * and truncating it is the right response.
 */
export async function getPostMedia(buildId: string): Promise<BuildMedia[]> {
  const { data, error } = await supabase
    .from("build_media")
    .select(POST_MEDIA_COLUMNS)
    .eq("build_id", buildId)
    .not("post_position", "is", null)
    .order("post_position", { ascending: true })
    .limit(MAX_POST_MEDIA);

  if (error) throw buildLayerError("getPostMedia", error);
  return (data ?? []) as BuildMedia[];
}

/**
 * Replace the whole set, in one round trip, positions taken from array order.
 *
 * THE WHOLE SET AT ONCE, NEVER ONE SLOT AT A TIME. Two reasons, and both are
 * about states that must not be reachable:
 *
 *   The partial unique index on (build_id, post_position) cannot be deferred —
 *   a partial unique index is an index, not a constraint, and only constraints
 *   defer. So a reorder must never hold two rows in one slot even for an
 *   instant, which rules out "move A to 1, then move B to 0" as separate
 *   statements. set_build_post_media() clears every position before assigning
 *   any, which is collision-free by construction.
 *
 *   Replacing a set is a clear and an assign. Split across two round trips, a
 *   failure between them leaves the build with no pictures AND no cover — the
 *   creator's arrangement lost because a request timed out. Inside the function
 *   it is one transaction: all of it lands or none of it does.
 *
 * Passing an empty array is not an error. It is how a creator says "no set",
 * which returns the build to resolveCover's original chain and clears the
 * mirror with it.
 *
 * RLS is NOT bypassed. The function is SECURITY INVOKER, so build_media's own
 * UPDATE policy decides whether this caller may rearrange this build — a media
 * id the caller cannot write is a row that did not match, and the function
 * raises rather than silently writing a shorter set.
 */
export async function setPostMedia(
  buildId: string,
  mediaIds: readonly string[]
): Promise<BuildMedia[]> {
  const ids = [...mediaIds];

  if (ids.length > MAX_POST_MEDIA) {
    throw new PostMediaError(
      "too_many",
      `a post shows at most ${MAX_POST_MEDIA} pictures — ${ids.length} were given`
    );
  }

  // Checked here as well as in the database because the caller can be told
  // WHICH rule it broke, and because a duplicate is a composer bug worth
  // failing on before it reaches the wire.
  if (new Set(ids).size !== ids.length) {
    throw new PostMediaError(
      "duplicate",
      "the same media cannot hold two positions in one post"
    );
  }

  const { data, error } = await supabase
    .rpc("set_build_post_media", { p_build_id: buildId, p_media_ids: ids })
    .select(POST_MEDIA_COLUMNS)
    .limit(MAX_POST_MEDIA);

  if (error) throw buildLayerError("setPostMedia", error);
  return (data ?? []) as unknown as BuildMedia[];
}

/**
 * Append one picture at the next free position.
 *
 * Reads the set first, which is unavoidable: "the next free position" is a
 * fact about the current set, and computing it in the database would mean a
 * second function whose only difference from the first is where the array came
 * from. The read also produces the "full" refusal, which is the answer the
 * composer actually needs.
 *
 * Already in the set is a no-op rather than an error. Dropping a picture onto
 * a slot it already occupies is not a mistake worth a message, and appending it
 * again would be the duplicate the database refuses anyway.
 */
export async function addPostMedia(
  buildId: string,
  mediaId: string
): Promise<BuildMedia[]> {
  const current = await getPostMedia(buildId);
  if (current.some((row) => row.id === mediaId)) return current;

  if (current.length >= MAX_POST_MEDIA) {
    throw new PostMediaError(
      "full",
      `this post already shows ${MAX_POST_MEDIA} pictures — remove one first`
    );
  }

  return setPostMedia(buildId, [...current.map((row) => row.id), mediaId]);
}

/**
 * Take one picture out of the set, closing the gap behind it.
 *
 * Positions stay DENSE: removing the middle of three leaves 0 and 1, not 0 and
 * 2. That is not tidiness — BG-P09's media block selects its arrangement by
 * counting the set, and a hole would make a three-picture post index a slot
 * that has nothing in it.
 *
 * The gap closes for free because setPostMedia assigns positions from array
 * order, so filtering the id out of the current order IS the renumbering.
 *
 * Not in the set is a no-op, and deliberately not an error: removing something
 * twice — a double click, a retried request — should leave the set as the
 * caller wanted it rather than failing the second time.
 *
 * THE REMOVED ROW'S TEXT GOES WITH IT, and there is no extra call here to do
 * that. set_build_post_media() clears the position and the post_text of every
 * row leaving the set in the same statement, and hands back only the text of
 * rows that are still in it — so the departing picture's words are gone by the
 * time this resolves, atomically, and the post_text CHECK is never presented
 * with a row that has text and no position.
 *
 * It is done there rather than here ON PURPOSE. Nulling the text from this side
 * first would take an extra round trip AND introduce a failure this cannot
 * have: if that write landed and the reorder then failed, the creator would be
 * left with the picture still in their post and the caption they wrote silently
 * gone. Inside the function it is one transaction — both, or neither.
 * supabase/tests/bg-p07c-post-text.sql check 6 is that behaviour against a real
 * database, which is the only place it can honestly be proved.
 */
export async function removePostMedia(
  buildId: string,
  mediaId: string
): Promise<BuildMedia[]> {
  const current = await getPostMedia(buildId);
  if (!current.some((row) => row.id === mediaId)) return current;

  return setPostMedia(
    buildId,
    current.filter((row) => row.id !== mediaId).map((row) => row.id)
  );
}

/**
 * Write the text that sits above one of the post's pictures.
 *
 * ONE ROW, ONE COLUMN. Unlike setPostMedia, this changes nothing about the set
 * or its order, so it does not need the whole-set function and does not take
 * the whole set: an edit to the words under picture three should not rewrite
 * picture one's position.
 *
 * Passing null — or a string that is only whitespace — CLEARS the text. Empty
 * string and null render identically, so they are normalised to one state here
 * rather than being allowed to become two indistinguishable ones in the table.
 * At position 0 clearing does not leave the entry blank: postEntriesOf falls
 * back to the build's description, which is where that entry's text comes from
 * until a creator overrides it.
 *
 * BOTH REFUSALS ARE ALSO DATABASE CONSTRAINTS, and are checked here so the
 * caller gets a sentence it can show rather than a PostgREST error string:
 *
 *   text_too_long  the CHECK caps post_text at POST_TEXT_MAX characters.
 *                  Measured by code point, as char_length measures it — see
 *                  the note on POST_TEXT_MAX — so this never accepts something
 *                  Postgres would then refuse, nor refuses something it allows.
 *   not_in_post    the CHECK also requires post_position IS NOT NULL: text
 *                  belongs to an ENTRY of the post, not to any picture on the
 *                  build. The read that establishes this is the same read the
 *                  composer has already done, and it is what turns an opaque
 *                  constraint violation into "that picture is not in the post".
 *
 * The length check runs BEFORE the read, because it needs no round trip to know
 * the answer.
 */
export async function setPostMediaText(
  buildId: string,
  mediaId: string,
  text: string | null
): Promise<BuildMedia> {
  const trimmed = text?.trim() || null;

  // Spread, not .length: iterating a string yields code points, so an emoji
  // counts one here exactly as it counts one in char_length().
  const characters = trimmed === null ? 0 : [...trimmed].length;

  if (characters > POST_TEXT_MAX) {
    throw new PostMediaError(
      "text_too_long",
      `an entry's text is at most ${POST_TEXT_MAX} characters — ${characters} were given`
    );
  }

  const current = await getPostMedia(buildId);
  if (!current.some((row) => row.id === mediaId)) {
    throw new PostMediaError(
      "not_in_post",
      "only a picture that is part of the post can carry text — add it to the post first"
    );
  }

  const { data, error } = await supabase
    .from("build_media")
    .update({ post_text: trimmed })
    // build_id as well as id: the membership read above already proves this row
    // is on this build, and pinning the write to both means a mediaId from
    // somewhere else could not be written even if that read were ever wrong.
    .eq("id", mediaId)
    .eq("build_id", buildId)
    .select(POST_MEDIA_COLUMNS)
    .single();

  if (error) throw buildLayerError("setPostMediaText", error);
  return data as BuildMedia;
}

// --- the thread ---------------------------------------------------------------

/**
 * The media fields the thread resolver reads.
 *
 * Both columns are REQUIRED here, unlike CoverMedia where post_position is
 * optional. The difference is deliberate: resolveCover has to keep working for
 * the gallery's narrow embed, which never asked about the set, and falling
 * through is a correct answer there. A caller asking for the THREAD is asking
 * about the set by definition, so a row that did not select these columns is a
 * caller bug — and a type error at the call site is a much better way to find
 * out than a thread that silently renders as empty. Select POST_MEDIA_COLUMNS.
 */
export type PostEntryMedia = Pick<BuildMedia, "id" | "post_position" | "post_text">;

/**
 * The build fields the thread resolver reads. Any build row satisfies this.
 *
 * `outcome` IS THE DESCRIPTION. The composer asks "What does it do? One
 * sentence, your words." and patches builds.outcome; the input is labelled
 * "Description" for the creator because "outcome" is a word about the record,
 * not a question about their work. There is no builds.description column in
 * this schema — see src/components/compose/CoverStrip.tsx for the save path.
 */
export type PostTextSource = Pick<Build, "outcome">;

/** One entry of the post: a picture, the words above it, and its place. */
export interface PostEntry<M extends PostEntryMedia = BuildMedia> {
  /** The picture this entry shows. */
  media: M;
  /** The words above it, or null when this entry has none. */
  text: string | null;
  /** Its place in the post, 0 to 3. */
  position: number;
}

/**
 * The post, as a card renders it: entries in order, each with its own text.
 *
 * THE ONE PLACE THE DESCRIPTION RULE LIVES. The first entry's text IS the
 * build's one-sentence description — exactly as a tweet's text sits above its
 * image — and it is NOT duplicated into post_text to make that true. Position 0
 * reads builds.outcome unless the creator has overridden it; every later entry
 * carries its own words or none. Every surface that draws the thread (BG-P09's
 * card, BG-P23's composer preview, the build page) goes through this function,
 * so no surface gets to reinvent the rule and none of them can drift apart.
 *
 * An overriding post_text at position 0 WINS, which is what makes the fallback a
 * default rather than a lock: a creator who wants the picture introduced
 * differently from the way the build is described can say so, and BG-P23 writes
 * that through setPostMediaText.
 *
 * PURE, AND IT QUERIES NOTHING — the same discipline as resolveCover above. Its
 * caller has the build row and the media list already, and a resolver that
 * fetched would turn a grid of cards back into a query per card.
 *
 * Rows with no position are dropped rather than being given one: they are
 * pictures hanging off a node, not entries of the post, so a caller may hand
 * over a whole media list and get back only the thread. And the result is sorted
 * by position rather than trusting the caller's order — getPostMedia returns
 * them ordered, but a card that concatenated two reads, or held a stale list,
 * would otherwise render a creator's post in an order they never chose.
 */
export function postEntriesOf<M extends PostEntryMedia>(
  build: PostTextSource | null | undefined,
  media: readonly M[]
): PostEntry<M>[] {
  const placed = media.filter(
    (row): row is M & { post_position: number } => typeof row.post_position === "number"
  );

  // filter() already returned a new array, so sorting it does not disturb the
  // list the caller handed over.
  placed.sort((a, b) => a.post_position - b.post_position);

  return placed.map((row) => ({
    media: row,
    position: row.post_position,
    text:
      row.post_position === 0
        ? row.post_text ?? build?.outcome ?? null
        : row.post_text,
  }));
}

// --- the aspect maths --------------------------------------------------------
//
// Three surfaces need this and they must agree: the card's media block (BG-P09),
// the composer's arrangement preview (BG-P23), and the build page. If each did
// its own clamping, a picture would be framed one way in the composer and
// another way on the card, and the creator would be arranging something other
// than what readers see.

/**
 * The tallest a picture is allowed to be: 3:4 portrait.
 *
 * Below this a single picture would push everything under it off the screen on
 * a phone, so a taller one is shown cropped to 3:4 rather than at its own
 * ratio.
 */
export const ASPECT_CAP_MIN = 0.75;

/**
 * The widest: 2:1.
 *
 * A panorama at its true ratio becomes a letterbox a few pixels tall inside a
 * card column, which shows nothing. Cropping to 2:1 shows the middle of it.
 */
export const ASPECT_CAP_MAX = 2.0;

/**
 * What a picture with no stored dimensions is assumed to be: 3:2 landscape.
 *
 * Not a cap — a default. It sits inside the capped range on purpose, so an
 * assumed ratio is never reported as cropped.
 */
export const ASSUMED_ASPECT = 1.5;

export interface Aspect {
  /** The media's true width / height, or ASSUMED_ASPECT if it has none. */
  ratio: number;
  /** `ratio` clamped to [ASPECT_CAP_MIN, ASPECT_CAP_MAX]. Frame with this. */
  capped: number;
  /** Whether the clamp bit — i.e. whether rendering at `capped` crops. */
  cropped: boolean;
}

/**
 * What shape to frame a picture at.
 *
 * `ratio` is the truth, `capped` is what to render, and `cropped` says whether
 * those differ — a caller that wants to mark a cropped picture, or offer a
 * "show whole image" affordance, reads the third field rather than comparing
 * the first two in floating point.
 *
 * MISSING DIMENSIONS DO NOT THROW AND DO NOT RETURN NaN. width and height are
 * populated by a browser-side probe at upload (see probeFile in media.ts) and
 * that probe is tolerant by design: a decoder that is absent, or a format the
 * browser will not decode, leaves both columns null rather than costing the
 * creator their upload. Those rows exist, they render, and the honest thing to
 * do with one is assume landscape and carry on — a card that threw on an
 * undescribed image would take the whole gallery down with it.
 *
 * A ratio is also treated as missing when it is zero, negative or not finite,
 * which covers a stored 0 as well as a null and means no caller can be handed
 * a number it cannot divide by.
 */
export function aspectOf(
  media: Partial<Pick<BuildMedia, "width" | "height">> | null | undefined
): Aspect {
  const width = media?.width ?? null;
  const height = media?.height ?? null;

  const usable =
    typeof width === "number" &&
    typeof height === "number" &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0;

  if (!usable) {
    return { ratio: ASSUMED_ASPECT, capped: ASSUMED_ASPECT, cropped: false };
  }

  const ratio = width / height;
  const capped = Math.min(ASPECT_CAP_MAX, Math.max(ASPECT_CAP_MIN, ratio));

  return { ratio, capped, cropped: capped !== ratio };
}
