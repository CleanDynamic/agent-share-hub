import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Guard: check seed data exists
    const { data: alexProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", "alex_prompt")
      .single();

    if (!alexProfile) {
      return new Response(
        JSON.stringify({ error: "Seed data not found. Run 'Seed demo data' first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch all seeded content items by their known titles ──
    const knownTitles = [
      "The Email Rewriter",
      "Weekly Report Generator — Zapier + ChatGPT",
      "The Research Assistant Blueprint",
      "How to Write Prompts That Actually Work",
      "Connect ChatGPT to Gmail in 15 Minutes",
      "How to Test If Your AI Prompt Actually Works",
      "Why My Customer Service Bot Kept Apologising for Everything",
      "Which AI Should You Use — And Does It Matter?",
      "The Full Content Calendar Stack",
      "The Meeting Notes Organiser",
      "I Tried to Automate My Newsletter and Made It Worse",
      "The Cross-Model Prompt Tester",
      "The Idea Unkiller",
      "The Only AI Skill You Actually Need as a Small Business Owner",
      "The Competitor Intelligence Blueprint",
      "The Instant Explainer",
      "The Time I Let AI Write My Entire Email Newsletter and Lost 40 Subscribers",
      "When to Use Claude vs ChatGPT — A Decision Framework",
    ];

    const { data: contentItems } = await supabase
      .from("content_items")
      .select("id, title, creator_id")
      .in("title", knownTitles);

    if (!contentItems || contentItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No seeded content items found." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map by title for easy lookup
    const byTitle: Record<string, { id: string; creator_id: string }> = {};
    for (const item of contentItems) {
      byTitle[item.title] = { id: item.id, creator_id: item.creator_id };
    }

    const get = (title: string) => byTitle[title];

    // ══════════════════════════════════════════
    // STEP 1 — ADD what_to_expect_blocks TO ALL 18 POSTS
    // ══════════════════════════════════════════
    const wteUpdates: { title: string; blocks: any[] }[] = [
      {
        title: "The Email Rewriter",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A rewritten version of your email — same message, better delivery. Typically 20-40% shorter than the original with a clearer opening line and a single obvious call to action." }],
      },
      {
        title: "Weekly Report Generator — Zapier + ChatGPT",
        blocks: [{ position: 1, block_type: "text", formatting_type: "bullets", text_content: "A formatted email in your inbox every Monday morning.\nA summary of your key metrics from the previous week.\nAction items highlighted separately from general updates.\nConsistent formatting every week with no manual work." }],
      },
      {
        title: "The Research Assistant Blueprint",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A structured research summary with 3-5 key themes, plain English explanations, and a list of claims that need verification. The AI will also suggest 3 follow-up questions to deepen your research." }],
      },
      {
        title: "How to Write Prompts That Actually Work",
        blocks: [
          { position: 1, block_type: "text", formatting_type: "paragraph", text_content: "By the end of this tutorial you will be able to write a prompt that gets consistently better results than what you were getting before. The before/after examples make the improvement immediately visible." },
          { position: 2, block_type: "text", formatting_type: "bullets", text_content: "You will understand why most prompts fail.\nYou will know the four elements every good prompt needs.\nYou will have three ready-to-use role prompts you can copy immediately." },
        ],
      },
      {
        title: "Connect ChatGPT to Gmail in 15 Minutes",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A working Zapier automation that watches for emails labelled needs-reply and saves a ChatGPT-drafted reply to your Gmail drafts folder automatically. Setup takes 15 minutes. After that it runs with no manual input." }],
      },
      {
        title: "How to Test If Your AI Prompt Actually Works",
        blocks: [{ position: 1, block_type: "text", formatting_type: "numbered", text_content: "A repeatable 5-point scoring rubric you can apply to any AI output.\nA clear pass/fail threshold (20 out of 25) before trusting a prompt in production.\nA methodology for improving prompts that score below threshold." }],
      },
      {
        title: "Why My Customer Service Bot Kept Apologising for Everything",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "You will understand exactly why the over-apologising happened and have a one-line fix you can apply to any customer service prompt right now. Tested on both ChatGPT and Claude." }],
      },
      {
        title: "Which AI Should You Use — And Does It Matter?",
        blocks: [
          { position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A clear decision framework: which AI to use for which job. After reading this you will stop second-guessing your tool choice and start with the right one every time." },
          { position: 2, block_type: "text", formatting_type: "bullets", text_content: "ChatGPT: best use case identified.\nClaude: best use case identified.\nGemini: best use case identified.\nA simple default rule for everything else." },
        ],
      },
      {
        title: "The Full Content Calendar Stack",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A complete three-tool automation that generates, approves, and schedules a full month of social media content. After the one-hour setup it runs automatically every month." }],
      },
      {
        title: "The Meeting Notes Organiser",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A structured meeting summary with attendees, decisions, action items with owners and deadlines, and next meeting date — all extracted from your raw notes in under 30 seconds." }],
      },
      {
        title: "I Tried to Automate My Newsletter and Made It Worse",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "You will understand exactly what caused the voice drift and have a fix that restores your writing style immediately. Includes a reusable voice-sample method you can apply to any AI writing task." }],
      },
      {
        title: "The Cross-Model Prompt Tester",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "Each AI model self-scores its own output on 5 dimensions. Run the same prompt in ChatGPT, Claude, and Gemini and compare the scores side by side to find which handles your use case best." }],
      },
      {
        title: "The Idea Unkiller",
        blocks: [{ position: 1, block_type: "text", formatting_type: "bullets", text_content: "At least 3 genuine strengths in your dismissed idea.\nThe specific context where the idea could actually work.\nOne small, immediately actionable version of the idea you can try today." }],
      },
      {
        title: "The Only AI Skill You Actually Need as a Small Business Owner",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "Three role prompts you can copy and use immediately for writing, advice, and customer emails. You will see the output quality difference in your first try." }],
      },
      {
        title: "The Competitor Intelligence Blueprint",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A weekly email digest of everything your competitors published — blog posts, social updates, press releases — summarised by ChatGPT and delivered to your inbox every Monday at 8am." }],
      },
      {
        title: "The Instant Explainer",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A plain English explanation of any topic in under 200 words, written as if for a curious 12-year-old. Ends with a one-sentence summary. Works on news articles, technical concepts, legal documents, anything." }],
      },
      {
        title: "The Time I Let AI Write My Entire Email Newsletter and Lost 40 Subscribers",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A precise diagnosis of what went wrong and a practical fix you can implement in your next piece of AI-assisted writing. The voice-sample method described restores your writing style immediately." }],
      },
      {
        title: "When to Use Claude vs ChatGPT — A Decision Framework",
        blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "A decision framework with clear rules for when to use Claude and when to use ChatGPT. Includes the overlap zone where both are equivalent and a simple default rule." }],
      },
    ];

    let wteCount = 0;
    for (const u of wteUpdates) {
      const item = get(u.title);
      if (!item) continue;
      await supabase
        .from("content_items")
        .update({ what_to_expect_blocks: u.blocks })
        .eq("id", item.id);
      wteCount++;
    }

    // ══════════════════════════════════════════
    // STEP 2 — ADD use_instructions TO SELECT BLOCKS
    // ══════════════════════════════════════════
    const useInstructionUpdates: { title: string; blockPosition: number; use_instructions: string }[] = [
      { title: "The Email Rewriter", blockPosition: 2, use_instructions: "Copy everything in this block. Open your AI tool. Paste as the first message before pasting your email." },
      { title: "The Research Assistant Blueprint", blockPosition: 2, use_instructions: 'Paste this as your first message, then type your research topic. Example: "Research the pros and cons of remote work for small businesses".' },
      { title: "How to Write Prompts That Actually Work", blockPosition: 3, use_instructions: "Use the BEFORE/AFTER example as a template. Replace the topic with your own. Test the after version and compare the output quality." },
      { title: "How to Test If Your AI Prompt Actually Works", blockPosition: 2, use_instructions: "Run your prompt 5 times with different inputs. Score each output against these 5 dimensions. Average the scores. Anything below 3 in any dimension needs fixing." },
      { title: "The Meeting Notes Organiser", blockPosition: 2, use_instructions: "Paste this as your first message. Then paste your raw meeting notes as your second message. The formatted summary appears immediately." },
      { title: "The Cross-Model Prompt Tester", blockPosition: 2, use_instructions: "Replace [PASTE YOUR PROMPT] with your actual prompt and [DESCRIBE THE TASK] with what you want the AI to do. Run this in ChatGPT, Claude, and Gemini separately. Compare the SCORES sections." },
      { title: "The Only AI Skill You Actually Need as a Small Business Owner", blockPosition: 3, use_instructions: "Copy the role prompt that matches your task. Paste it as the first line of your message, then add your specific request after it." },
    ];

    let useInstrCount = 0;
    for (const u of useInstructionUpdates) {
      const item = get(u.title);
      if (!item) continue;
      const { error } = await supabase
        .from("content_blocks")
        .update({ use_instructions: u.use_instructions })
        .eq("content_id", item.id)
        .eq("position", u.blockPosition);
      if (!error) useInstrCount++;
    }

    // ══════════════════════════════════════════
    // STEP 3 — ADD formatting_type TO EXISTING BLOCKS
    // ══════════════════════════════════════════
    const formattingUpdates: { title: string; blockPosition: number; formatting_type: string }[] = [
      { title: "Weekly Report Generator — Zapier + ChatGPT", blockPosition: 2, formatting_type: "bullets" },
      { title: "Weekly Report Generator — Zapier + ChatGPT", blockPosition: 3, formatting_type: "numbered" },
      { title: "The Research Assistant Blueprint", blockPosition: 3, formatting_type: "bullets" },
      { title: "How to Write Prompts That Actually Work", blockPosition: 3, formatting_type: "paragraph" },
      { title: "Connect ChatGPT to Gmail in 15 Minutes", blockPosition: 2, formatting_type: "bullets" },
      { title: "Connect ChatGPT to Gmail in 15 Minutes", blockPosition: 3, formatting_type: "numbered" },
      { title: "How to Test If Your AI Prompt Actually Works", blockPosition: 2, formatting_type: "numbered" },
      { title: "How to Test If Your AI Prompt Actually Works", blockPosition: 3, formatting_type: "numbered" },
      { title: "Which AI Should You Use — And Does It Matter?", blockPosition: 2, formatting_type: "paragraph" },
      { title: "The Full Content Calendar Stack", blockPosition: 2, formatting_type: "numbered" },
      { title: "The Full Content Calendar Stack", blockPosition: 3, formatting_type: "bullets" },
      { title: "The Idea Unkiller", blockPosition: 2, formatting_type: "numbered" },
      { title: "The Only AI Skill You Actually Need as a Small Business Owner", blockPosition: 2, formatting_type: "numbered" },
      { title: "The Only AI Skill You Actually Need as a Small Business Owner", blockPosition: 3, formatting_type: "paragraph" },
    ];

    let fmtCount = 0;
    for (const u of formattingUpdates) {
      const item = get(u.title);
      if (!item) continue;
      const { error } = await supabase
        .from("content_blocks")
        .update({ formatting_type: u.formatting_type })
        .eq("content_id", item.id)
        .eq("position", u.blockPosition);
      if (!error) fmtCount++;
    }

    // Set all remaining blocks to 'paragraph' as safe default
    const allContentIds = Object.values(byTitle).map((v) => v.id);
    await supabase
      .from("content_blocks")
      .update({ formatting_type: "paragraph" })
      .in("content_id", allContentIds)
      .eq("formatting_type", "paragraph"); // no-op for already-set ones

    // ══════════════════════════════════════════
    // STEP 4 — CREATE ONE DEMO PROJECT
    // ══════════════════════════════════════════

    // Look up priya's profile
    const { data: priyaProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", "priya_builds")
      .single();

    let projectCreated = 0;

    if (priyaProfile) {
      const post1 = get("The Email Rewriter");
      const post2 = get("Weekly Report Generator — Zapier + ChatGPT");
      const post5 = get("Connect ChatGPT to Gmail in 15 Minutes");

      if (post1 && post2 && post5) {
        // Check if project already exists
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("title", "The Complete Email Automation Stack")
          .maybeSingle();

        let projectId: string;

        if (existingProject) {
          projectId = existingProject.id;
        } else {
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

          const { data: newProject, error: projError } = await supabase
            .from("projects")
            .insert({
              title: "The Complete Email Automation Stack",
              description: "A three-part system to rewrite, route, and report on your emails automatically. Set it up once and never manually process emails the same way again.",
              creator_id: priyaProfile.id,
              status: "approved",
              approved_at: sevenDaysAgo,
              package_price_enabled: true,
              package_price_gbp: 3.99,
            })
            .select("id")
            .single();

          if (projError) throw new Error(`Project insert failed: ${projError.message}`);
          projectId = newProject.id;

          // Insert project_components
          await supabase.from("project_components" as any).insert([
            {
              project_id: projectId,
              linked_content_id: post1.id,
              position: 1,
              component_type: "linked",
              component_label: "Rewrite your drafts",
              component_note: "Start here — get the core prompt working first.",
            },
            {
              project_id: projectId,
              linked_content_id: post5.id,
              position: 2,
              component_type: "linked",
              component_label: "Connect ChatGPT to Gmail",
              component_note: "Set up the Zapier automation once the prompt is working.",
            },
            {
              project_id: projectId,
              linked_content_id: post2.id,
              position: 3,
              component_type: "linked",
              component_label: "Automate your weekly report",
              component_note: "The final piece — close the loop with automated reporting.",
            },
          ]);

          // Insert content_views for the project
          const viewerUsernames = ["power_user_99", "normie_sam", "dev_tester", "alex_prompt", "sofia_creates"];
          const { data: viewers } = await supabase
            .from("profiles")
            .select("id")
            .in("username", viewerUsernames);

          if (viewers && viewers.length > 0) {
            await supabase.from("content_views").insert(
              viewers.map((v: any) => ({ content_id: projectId, user_id: v.id }))
            );
          }

          // Update project view_count
          await supabase
            .from("projects")
            .update({ view_count: 5 })
            .eq("id", projectId);

          projectCreated = 1;
        }
      }
    }

    // ══════════════════════════════════════════
    // STEP 5 — FINAL SUMMARY
    // ══════════════════════════════════════════
    const summary = {
      what_to_expect_blocks_updated: wteCount,
      use_instructions_added: useInstrCount,
      formatting_types_set: fmtCount,
      projects_created: projectCreated,
      status: "Seed update complete",
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
