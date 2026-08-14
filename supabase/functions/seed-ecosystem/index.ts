import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CREATORS, DEMO_EMAIL_DOMAIN, scaffoldSections, toArticleBody, wordCount } from "./content.ts";
import { POSTS } from "./posts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join("-").slice(0, 70);

const daysAgoIso = (d: number) =>
  new Date(Date.now() - d * 86400000).toISOString();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Wipe previous ecosystem seed (cascades to all child rows) ──
    let removed = 0;
    for (let page = 1; page <= 10; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
      const users = data?.users ?? [];
      if (!users.length) break;
      for (const u of users) {
        if (u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
          await db.auth.admin.deleteUser(u.id);
          removed++;
        }
      }
      if (users.length < 200) break;
    }

    // ── 2. Creators ──
    const ids: string[] = [];
    for (const c of CREATORS) {
      const { data, error } = await db.auth.admin.createUser({
        email: `${c.username}@${DEMO_EMAIL_DOMAIN}`,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { username: c.username, display_name: c.display_name },
      });
      if (error || !data.user) throw new Error(`creator ${c.username}: ${error?.message}`);
      const uid = data.user.id;
      ids.push(uid);

      await db.from("profiles").update({
        username: c.username,
        display_name: c.display_name,
        bio: c.bio,
        location: c.location,
        website_url: c.website_url ?? null,
        twitter_handle: c.twitter_handle ?? null,
        account_type: c.account_type,
        is_creator: c.is_creator,
        is_curator: c.is_curator ?? false,
        user_interests: c.interests,
        user_ai_tools: c.tools,
        level: c.level,
        is_verified: c.is_creator,
      } as any).eq("id", uid);

      await db.from("user_progress").upsert({
        user_id: uid,
        xp_total: c.xp,
        level: c.level,
        streak_current: c.streak,
        streak_best: Math.max(c.streak, c.streak + 4),
        streak_days: c.streak,
        last_active_date: new Date().toISOString().slice(0, 10),
      } as any);

      await db.from("xp_events").insert([
        { user_id: uid, amount: 50, reason: "published_post", source_type: "content" },
        { user_id: uid, amount: 20, reason: "received_rating", source_type: "content" },
        { user_id: uid, amount: 10, reason: "daily_activity", source_type: "streak" },
      ] as any);

      const streakRows = Array.from({ length: Math.min(c.streak, 14) }, (_, i) => ({
        user_id: uid,
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
        kind: "activity",
      }));
      if (streakRows.length) await db.from("streak_days").upsert(streakRows as any);

      if (c.is_curator) {
        await db.from("curators").insert({ user_id: uid } as any);
      }
      if (c.service) {
        await db.from("service_listings").insert({
          creator_id: uid,
          title: c.service.title,
          description: c.service.description,
          price_gbp: c.service.price_gbp,
          is_active: true,
        } as any);
      }
    }

    // ── 3. Posts ──
    const postIds: Record<string, string> = {};
    for (const spec of POSTS) {
      const sections = scaffoldSections(spec);
      const stageId = spec.stageGrid ? crypto.randomUUID() : undefined;
      const created = daysAgoIso(spec.daysAgo);
      const creator = ids[spec.author % ids.length];

      let stage_grids: unknown = null;
      if (spec.stageGrid && stageId) {
        const blocks: Record<string, unknown> = {};
        spec.stageGrid.blocks.forEach((b, i) => {
          const bid = crypto.randomUUID();
          blocks[bid] = {
            id: bid,
            name: b.name,
            type: b.type,
            width: 220,
            height: 120,
            locked: false,
            z_index: 0,
            stage_id: stageId,
            created_at: created,
            updated_at: created,
            position_x: -320 + (i % 2) * 280,
            position_y: -220 + Math.floor(i / 2) * 190,
            properties: {},
          };
        });
        stage_grids = {
          stages: {
            [stageId]: {
              id: stageId,
              height: 360,
              created_at: created,
              updated_at: created,
              stage_name: spec.stageGrid.name,
              width_mode: "wide",
              grid_spacing: 20,
              content_item_id: "",
              background_style: "dot",
              order_in_document: 0,
            },
          },
          blocks,
          connections: {},
        };
      }

      const row: Record<string, unknown> = {
        creator_id: creator,
        title: spec.title,
        description: spec.desc,
        content_type: spec.content_type,
        post_type: spec.post_type,
        difficulty: spec.difficulty,
        ai_tools: spec.ai_tools,
        use_cases: spec.use_cases,
        topics: spec.topics,
        custom_tags: spec.custom_tags,
        tags: [],
        status: "approved",
        visibility: "public",
        approved_at: created,
        created_at: created,
        published_at: created,
        slug: `${slugify(spec.title)}-${spec.key}`,
        cover_image_url: spec.cover ?? null,
        cover_image_focal_x: 0.5,
        cover_image_focal_y: 0.4,
        article_body: toArticleBody(sections, stageId),
        stage_grids,
        view_count: spec.metrics.views,
        download_count: spec.metrics.downloads,
        avg_rating: spec.metrics.rating || null,
        rating_count: spec.metrics.ratings,
        monetisation_type: spec.monetisation === "pwyw" ? "free" : spec.monetisation,
        price_gbp: spec.price ?? null,
        donation_enabled: spec.monetisation === "donation",
        pwyw_enabled: spec.monetisation === "pwyw",
      };

      if (spec.bounty) {
        row.bounty_status = spec.bounty.status;
        row.bounty_reward_type = spec.bounty.reward_type;
        row.bounty_reward_amount = spec.bounty.amount ?? null;
        row.bounty_reward_currency = "GBP";
        row.bounty_deadline = daysAgoIso(-21);
        row.bounty_is_meta = spec.bounty.is_meta ?? false;
      }

      const { data: ins, error: insErr } = await db
        .from("content_items")
        .insert(row as any)
        .select("id")
        .single();
      if (insErr || !ins) throw new Error(`post ${spec.key}: ${insErr?.message}`);
      const pid = ins.id as string;
      postIds[spec.key] = pid;

      // Blocks
      await db.from("content_blocks").insert(
        spec.blocks.map((b, i) => ({
          content_id: pid,
          position: i,
          block_type: b.type,
          text_content: b.text,
          formatting_type: b.type === "code" ? "code" : "paragraph",
          use_instructions: b.instructions ?? null,
          is_preview: b.preview ?? false,
        })) as any
      );

      // Results
      if (spec.results?.length) {
        await db.from("content_item_results").insert(
          spec.results.map((r, i) => ({
            content_item_id: pid,
            kind: r.kind,
            text_content: r.text ?? null,
            media_url: r.url ?? null,
            caption: r.caption ?? null,
            position: i,
          })) as any
        );
      }

      // Changelog + version
      await db.from("content_changelogs").insert({
        content_id: pid,
        version_label: "v1.0",
        change_note: "First published version.",
        created_by: creator,
        created_at: created,
        fields_changed_count: 6,
      } as any);

      // Ratings, comments, views, downloads, saves, library, interactions
      const raters = ids.filter((id) => id !== creator).slice(0, 4);
      if (spec.metrics.ratings > 0) {
        await db.from("content_ratings").insert(
          raters.map((uid, i) => ({
            content_id: pid,
            user_id: uid,
            rating: i === 0 ? 5 : i === 3 ? 4 : 5,
          })) as any
        );
      }

      const commenter = ids[(spec.author + 3) % ids.length];
      const replier = ids[(spec.author + 5) % ids.length];
      const { data: parent } = await db
        .from("primitive_comments")
        .insert({
          anchor_type: "post",
          anchor_id: pid,
          author_id: commenter,
          body_text:
            "Tried this on our own data this morning. The flagging-rather-than-guessing rule is the part I'd been missing — my version was quietly filling gaps and I only noticed because two numbers disagreed.",
        } as any)
        .select("id")
        .single();
      if (parent) {
        await db.from("primitive_comments").insert([
          {
            anchor_type: "post",
            anchor_id: pid,
            parent_comment_id: parent.id,
            author_id: creator,
            body_text:
              "That's the failure I hit too. If you keep the raw value alongside the parsed one you can usually see exactly where it started filling in.",
          },
          {
            anchor_type: "post",
            anchor_id: pid,
            parent_comment_id: parent.id,
            author_id: replier,
            body_text:
              "Second this. Twenty test inputs took me fifteen minutes and saved a fortnight of guessing.",
          },
        ] as any);
      }

      await db.from("content_views").insert(
        ids.slice(0, 5).map((uid) => ({ content_id: pid, user_id: uid })) as any
      );
      if (spec.metrics.downloads > 0) {
        await db.from("downloads").insert(
          ids.slice(0, 3).map((uid) => ({ content_id: pid, user_id: uid })) as any
        );
      }
      await db.from("user_saves").insert(
        ids.slice(0, 2).map((uid) => ({ content_id: pid, user_id: uid })) as any
      );
      await db.from("user_library").insert(
        ids.slice(2, 4).map((uid) => ({ content_id: pid, user_id: uid })) as any
      );
      await db.from("user_interactions").insert([
        { user_id: commenter, content_id: pid, interaction_type: "commented" },
        { user_id: replier, content_id: pid, interaction_type: "bookmark" },
      ] as any);

      // Revenue split on paid posts
      if (spec.monetisation === "paid") {
        await db.from("revenue_splits").insert({
          content_id: pid,
          recipient_id: ids[(spec.author + 1) % ids.length],
          percentage: 25,
          set_by: creator,
        } as any);
      }

      // Bounty extras
      if (spec.bounty?.subs?.length) {
        const { data: subs } = await db
          .from("meta_bounty_sub_definitions")
          .insert(
            spec.bounty.subs.map((s, i) => ({
              meta_bounty_id: pid,
              title: s.title,
              description: s.description,
              target_amount: s.target,
              position: i,
            })) as any
          )
          .select("id");
        if (subs?.length) {
          await db.from("meta_bounty_pledges").insert(
            subs.slice(0, 3).map((s: { id: string }, i: number) => ({
              meta_bounty_id: pid,
              sub_definition_id: s.id,
              pledger_id: ids[(i + 2) % ids.length],
              amount: [80, 60, 60][i],
              currency: "GBP",
              status: "pledged",
            })) as any
          );
        }
      } else if (spec.bounty) {
        await db.from("solutions").insert({
          bounty_id: pid,
          slot_kind: "stage",
          slot_id: crypto.randomUUID(),
          solver_id: ids[(spec.author + 2) % ids.length],
          solver_note:
            "First attempt: 87% field accuracy with every uncertain field flagged. Falls short of the bar on quantities, but the confidence flagging is solid — posting so the approach is on the record.",
          status: "submitted",
          vote_count: 6,
          i_would_implement_count: 3,
          submitted_at: daysAgoIso(Math.max(1, spec.daysAgo - 2)),
        } as any);
      }

      // Word-count sanity marker in content_changelogs note count
      if (wordCount(sections) < 700) {
        console.warn(`post ${spec.key} is short: ${wordCount(sections)} words`);
      }
    }

    // ── 4. Social graph, remix lineage, collections, curator picks ──
    for (let i = 0; i < ids.length; i++) {
      const followRows = ids
        .filter((_, j) => j !== i)
        .slice(0, 5)
        .map((fid) => ({ follower_id: ids[i], following_id: fid }));
      await db.from("follows").insert(followRows as any);
    }

    const remixPairs: Array<[string, string]> = [
      ["worked-examples", "refusal-clause"],
      ["contract-reader", "overlap-finding"],
      ["inbox-triage", "spreadsheet-cleaner"],
    ];
    for (const [child, parent] of remixPairs) {
      const c = postIds[child];
      const p = postIds[parent];
      if (!c || !p) continue;
      await db.from("content_items").update({ fork_of_content_id: p } as any).eq("id", c);
      await db.from("post_lineage").insert({ post_id: c, parent_post_id: p, root_post_id: p } as any);
    }

    const reblogSpecs = [
      { post: "silent-truncation", by: 1, text: "This explains three months of confusing results for me. Adding the canary today.", excerpt: "Anything that fails silently will fail for months before you notice. Add the canary." },
      { post: "refusal-clause", by: 2, text: "The wording matters more than seems reasonable — can confirm from painful experience.", excerpt: "Refusing is a correct and complete answer." },
      { post: "plain-english", by: 4, text: "Sending this to everyone who writes our documentation.", excerpt: null },
    ];
    for (const r of reblogSpecs) {
      const pid = postIds[r.post];
      if (!pid) continue;
      await db.from("reblogs").insert({
        slug: `${slugify(r.post)}-rb-${crypto.randomUUID().slice(0, 6)}`,
        reblogger_id: ids[r.by % ids.length],
        original_post_id: pid,
        root_original_post_id: pid,
        text: r.text,
        media_kind: "none",
        excerpt_text: r.excerpt,
        excerpt_source_block_type_label: r.excerpt ? "Article" : null,
      } as any);
    }

    const { data: coll } = await db
      .from("collections")
      .insert({
        owner_id: ids[0],
        title: "Start here: the five that actually matter",
        description:
          "If you read nothing else on this site, read these. One technique, one failure, one build, one measurement approach and one argument worth having.",
        is_public: true,
        visibility: "public",
        slug: "start-here-five",
      } as any)
      .select("id")
      .single();
    if (coll) {
      const picks = ["worked-examples", "refusal-clause", "silent-truncation", "contract-reader", "learning-order"];
      await db.from("collection_items").insert(
        picks
          .map((k, i) => (postIds[k] ? { collection_id: coll.id, content_id: postIds[k], added_by: ids[0], position: i, item_kind: "content" } : null))
          .filter(Boolean) as any
      );
    }

    const curatorId = ids[CREATORS.findIndex((c) => c.is_curator)];
    for (const k of ["refusal-clause", "silent-truncation", "cheaper-wins"]) {
      if (!postIds[k]) continue;
      await db.from("curator_recommendations").insert({
        curator_id: curatorId,
        content_id: postIds[k],
        recommendation_text:
          "Short, tested, and honest about where it breaks. The kind of write-up I wish more of this site looked like.",
        is_active: true,
      } as any);
    }

    // ── 5. Projects ──
    const { data: project } = await db
      .from("projects")
      .insert({
        creator_id: ids[0],
        title: "The small-team admin kit",
        description:
          "Four setups that between them remove most of the repetitive administrative work from a team of under twenty: inbox triage, meeting actions, spreadsheet cleaning and support drafting. Designed to be adopted one at a time.",
        cover_image_url: null,
        status: "approved",
        approved_at: daysAgoIso(6),
        view_count: 2140,
      } as any)
      .select("id")
      .single();
    if (project) {
      const comps = ["inbox-triage", "meeting-to-actions", "spreadsheet-cleaner", "support-replies"];
      await db.from("project_components").insert(
        comps
          .map((k, i) =>
            postIds[k]
              ? {
                  project_id: project.id,
                  position: i,
                  component_type: "linked",
                  linked_content_id: postIds[k],
                  show_on_browse: true,
                  component_label: `Step ${i + 1}`,
                  component_note: "Adopt this one on its own first; it works standalone.",
                }
              : null
          )
          .filter(Boolean) as any
      );
    }

    return json({
      message: `Seeded ${Object.keys(postIds).length} posts from ${ids.length} creators.`,
      removed_previous_demo_users: removed,
      posts: Object.keys(postIds).length,
      creators: ids.length,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
