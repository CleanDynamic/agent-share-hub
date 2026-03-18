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

    // Idempotency guard
    const existing = await supabase.from("profiles").select("id").eq("username", "alex_prompt").single();
    if (existing.data) return new Response(JSON.stringify({ message: "Already seeded" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ═══ STEP 1 — CREATE 12 AUTH USERS ═══
    const password = "DemoUser123!";
    const emails: Record<string, string> = {
      alex: "alex@neoscale.demo",
      priya: "priya@neoscale.demo",
      marcus: "marcus@neoscale.demo",
      sofia: "sofia@neoscale.demo",
      jamie: "jamie@neoscale.demo",
      chen: "chen@neoscale.demo",
      isabelle: "isabelle@neoscale.demo",
      sam: "sam@neoscale.demo",
      power: "power@neoscale.demo",
      lurker: "lurker@neoscale.demo",
      newjoin: "newjoin@neoscale.demo",
      devtest: "devtest@neoscale.demo",
    };

    const userResults = await Promise.all(
      Object.entries(emails).map(async ([key, email]) => {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw new Error(`Failed to create ${key}: ${error.message}`);
        return [key, data.user.id] as [string, string];
      })
    );

    const users: Record<string, string> = Object.fromEntries(userResults);

    // ═══ STEP 2 — UPDATE PROFILE ROWS ═══
    const profileUpdates: Record<string, any> = {
      alex: {
        username: "alex_prompt", display_name: "Alex Carter", is_creator: true,
        account_type: "creator",
        bio: "Prompt engineer. 5 years writing AI setups for marketing teams. If it works in ChatGPT it works everywhere.",
        twitter_handle: "alexcarter_ai",
        user_interests: ["Social Media", "Content"], user_ai_tools: ["ChatGPT", "Claude"],
      },
      priya: {
        username: "priya_builds", display_name: "Priya Sharma", is_creator: true,
        account_type: "creator",
        bio: "Automation consultant. I connect AI to real business workflows. Zapier and Make specialist.",
        twitter_handle: "priya_builds",
        user_interests: ["Business", "Productivity"], user_ai_tools: ["ChatGPT", "Zapier", "Make"],
      },
      marcus: {
        username: "marcus_ai", display_name: "Marcus Webb", is_creator: true,
        account_type: "creator",
        bio: "Ex-developer turned AI builder. I write the blueprints I wish existed when I started.",
        user_interests: ["Research", "Business"], user_ai_tools: ["Claude", "Gemini"],
      },
      sofia: {
        username: "sofia_creates", display_name: "Sofia Reyes", is_creator: true,
        account_type: "creator",
        bio: "Content creator. I use AI to build systems that save time. Honest reviews and honest failures.",
        twitter_handle: "sofiareyes_co",
        user_interests: ["Content", "Social Media"], user_ai_tools: ["ChatGPT", "Claude"],
      },
      jamie: {
        username: "jamie_workflow", display_name: "Jamie Liu", is_creator: true,
        account_type: "creator",
        bio: "Operations manager. AI automation nerd. I document every workflow I build.",
        user_interests: ["Productivity", "Business"], user_ai_tools: ["ChatGPT", "Zapier"],
      },
      chen: {
        username: "chen_labs", display_name: "Chen Zhang", is_creator: true,
        account_type: "creator",
        bio: "I test prompts across 6 AI models and publish what actually works. No hype. Just results.",
        user_interests: ["Research", "Learning"], user_ai_tools: ["Claude", "Gemini", "ChatGPT"],
      },
      isabelle: {
        username: "isabelle_normie", display_name: "Isabelle Martin", is_creator: true,
        account_type: "creator",
        bio: "Not a developer. Small business owner who learned AI tools. I help other non-techies do the same.",
        twitter_handle: "isabellenormie",
        user_interests: ["Business", "Email"], user_ai_tools: ["ChatGPT"],
      },
      sam: {
        username: "normie_sam", display_name: "Sam Okafor", is_creator: false,
        account_type: "user",
        bio: "Just trying to use AI without a computer science degree.",
        user_interests: ["Productivity", "Email"], user_ai_tools: ["ChatGPT"],
      },
      power: {
        username: "power_user_99", display_name: "Power User", is_creator: false,
        account_type: "user",
        bio: "Heavy AI user. I download and test everything on this platform.",
        user_interests: ["Research", "Business", "Productivity"], user_ai_tools: ["ChatGPT", "Claude", "Gemini"],
      },
      lurker: {
        username: "quiet_lurker", display_name: "Quiet Lurker", is_creator: false,
        account_type: "user",
        bio: "",
        user_interests: ["Learning"], user_ai_tools: ["ChatGPT"],
      },
      newjoin: {
        username: "new_joiner", display_name: "New Here", is_creator: false,
        account_type: "user",
        bio: "Just joined. Still figuring things out.",
        user_interests: ["Productivity"], user_ai_tools: ["ChatGPT"],
      },
      devtest: {
        username: "dev_tester", display_name: "Dev Tester", is_creator: false,
        account_type: "user",
        bio: "Testing the platform features.",
        user_interests: ["Business", "Research"], user_ai_tools: ["Claude", "ChatGPT"],
      },
    };

    await Promise.all(
      Object.entries(profileUpdates).map(([key, data]) =>
        supabase.from("profiles").update(data).eq("id", users[key])
      )
    );

    // ═══ CURATORS ═══
    await supabase.from("curators").insert([
      { user_id: users.alex, is_active: true, approved_by: users.alex },
      { user_id: users.chen, is_active: true, approved_by: users.alex },
    ]);
    await supabase.from("profiles").update({ is_curator: true, curator_application_status: "approved" }).in("id", [users.alex, users.chen]);

    // ═══ STEP 3 — FOLLOWS (organic follower/following counts) ═══
    // Build a realistic follow graph
    const followPairs: [string, string][] = [
      // alex is popular — followed by many
      ["priya", "alex"], ["marcus", "alex"], ["sofia", "alex"], ["jamie", "alex"],
      ["chen", "alex"], ["isabelle", "alex"], ["sam", "alex"], ["power", "alex"],
      ["devtest", "alex"],
      // priya gets follows
      ["alex", "priya"], ["marcus", "priya"], ["sofia", "priya"], ["jamie", "priya"],
      ["chen", "priya"], ["sam", "priya"], ["power", "priya"],
      // marcus
      ["alex", "marcus"], ["priya", "marcus"], ["sofia", "marcus"], ["chen", "marcus"],
      ["power", "marcus"],
      // sofia
      ["alex", "sofia"], ["priya", "sofia"], ["marcus", "sofia"], ["jamie", "sofia"],
      ["isabelle", "sofia"], ["sam", "sofia"],
      // chen
      ["alex", "chen"], ["marcus", "chen"], ["sofia", "chen"], ["power", "chen"],
      ["devtest", "chen"],
      // jamie
      ["alex", "jamie"], ["priya", "jamie"], ["chen", "jamie"],
      // isabelle
      ["alex", "isabelle"], ["sofia", "isabelle"], ["sam", "isabelle"],
      // cross-follows among users
      ["sam", "power"], ["power", "sam"],
      ["lurker", "alex"], ["lurker", "sofia"],
      ["newjoin", "alex"],
    ];

    await supabase.from("follows").insert(
      followPairs.map(([follower, following]) => ({
        follower_id: users[follower],
        following_id: users[following],
      }))
    );

    // Recompute follower_count and following_count from actual rows
    const followerCounts: Record<string, number> = {};
    const followingCounts: Record<string, number> = {};
    for (const [follower, following] of followPairs) {
      followerCounts[following] = (followerCounts[following] || 0) + 1;
      followingCounts[follower] = (followingCounts[follower] || 0) + 1;
    }
    await Promise.all(
      Object.keys(users).map((key) =>
        supabase.from("profiles").update({
          follower_count: followerCounts[key] || 0,
          following_count: followingCounts[key] || 0,
        }).eq("id", users[key])
      )
    );

    // ═══ STEP 4 — CONTENT ITEMS ═══
    const contentDefs = [
      // alex — 4 items
      { key: "c1", creator: "alex", title: "The Cold Email Prompt That Books Meetings", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "A battle-tested prompt for writing cold emails that actually get replies. Includes follow-up sequence.", use_cases: ["Business", "Email"], monetisation_type: "free", status: "approved" },
      { key: "c2", creator: "alex", title: "Social Media Caption Generator v3", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT", "Claude"], description: "Generate scroll-stopping captions for Instagram, LinkedIn, and Twitter. Works across all AI models.", use_cases: ["Social Media", "Content"], monetisation_type: "free", status: "approved" },
      { key: "c3", creator: "alex", title: "AI Content Audit Framework", content_type: "guide", difficulty: "intermediate", ai_tools: ["ChatGPT", "Claude"], description: "A step-by-step guide to auditing your existing content library using AI. Includes scoring rubric.", use_cases: ["Content", "Business"], monetisation_type: "free", status: "approved" },
      { key: "c4", creator: "alex", title: "LinkedIn Thought Leadership Prompt Pack", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "12 prompts for writing LinkedIn posts that build authority without sounding like a robot.", use_cases: ["Social Media"], monetisation_type: "pwyw", is_pwyw: true, pwyw_enabled: true, pwyw_floor_gbp: 0, status: "approved" },
      // priya — 3 items
      { key: "c5", creator: "priya", title: "Zapier + ChatGPT: Auto-Reply to Form Submissions", content_type: "automation-setup", difficulty: "intermediate", ai_tools: ["ChatGPT", "Zapier"], description: "Complete Zapier workflow to auto-generate personalised replies to form submissions using GPT.", use_cases: ["Business", "Productivity"], monetisation_type: "free", status: "approved" },
      { key: "c6", creator: "priya", title: "Make.com Client Onboarding Automation", content_type: "automation-setup", difficulty: "advanced", ai_tools: ["Make"], description: "End-to-end Make scenario for onboarding new clients: welcome email, folder creation, task assignment.", use_cases: ["Business"], monetisation_type: "free", status: "approved" },
      { key: "c7", creator: "priya", title: "The Automation Decision Tree", content_type: "guide", difficulty: "beginner", ai_tools: ["ChatGPT", "Zapier", "Make"], description: "Should you automate it? A practical decision tree for non-developers choosing the right tool.", use_cases: ["Productivity", "Business"], monetisation_type: "free", status: "approved" },
      // marcus — 3 items
      { key: "c8", creator: "marcus", title: "Claude vs ChatGPT: Research Prompt Comparison", content_type: "guide", difficulty: "intermediate", ai_tools: ["Claude", "ChatGPT"], description: "Head-to-head comparison of Claude and ChatGPT on 10 real research tasks. With actual outputs.", use_cases: ["Research"], monetisation_type: "free", status: "approved" },
      { key: "c9", creator: "marcus", title: "Build a Custom GPT for Your Company Wiki", content_type: "blueprint", difficulty: "advanced", ai_tools: ["ChatGPT"], description: "Step-by-step blueprint to create a Custom GPT trained on your company documentation.", use_cases: ["Business", "Research"], monetisation_type: "free", status: "approved" },
      { key: "c10", creator: "marcus", title: "The API Integration Starter Kit", content_type: "blueprint", difficulty: "advanced", ai_tools: ["Claude"], description: "Blueprint for connecting AI APIs to your existing tools. Includes authentication patterns and error handling.", use_cases: ["Business"], monetisation_type: "pwyw", is_pwyw: true, pwyw_enabled: true, pwyw_floor_gbp: 1, status: "approved" },
      // sofia — 3 items
      { key: "c11", creator: "sofia", title: "AI Content Calendar Template", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "A monthly content calendar you fill by chatting with AI. Includes niche selection and posting schedule.", use_cases: ["Content", "Social Media"], monetisation_type: "free", status: "approved" },
      { key: "c12", creator: "sofia", title: "How I Failed at AI Video Generation (and What Worked)", content_type: "failure-post", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "Honest review of trying 4 AI video tools for my small business. Two were terrible. One was brilliant.", use_cases: ["Content"], monetisation_type: "free", status: "approved" },
      { key: "c13", creator: "sofia", title: "The Instagram Reels Script Prompt", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT", "Claude"], description: "Generate short-form video scripts optimised for Instagram Reels. Includes hook formulas.", use_cases: ["Social Media", "Content"], monetisation_type: "free", status: "approved" },
      // jamie — 2 items
      { key: "c14", creator: "jamie", title: "Meeting Notes to Action Items Workflow", content_type: "automation-setup", difficulty: "intermediate", ai_tools: ["ChatGPT", "Zapier"], description: "Paste your meeting notes, get structured action items with owners and deadlines. Zapier integration included.", use_cases: ["Productivity", "Business"], monetisation_type: "free", status: "approved" },
      { key: "c15", creator: "jamie", title: "The Operations Dashboard Prompt Set", content_type: "prompt-file", difficulty: "intermediate", ai_tools: ["ChatGPT"], description: "5 prompts to extract KPIs, blockers, and weekly summaries from team updates.", use_cases: ["Productivity"], monetisation_type: "free", status: "approved" },
      // chen — 3 items
      { key: "c16", creator: "chen", title: "Multi-Model Prompt Testing Framework", content_type: "guide", difficulty: "advanced", ai_tools: ["Claude", "Gemini", "ChatGPT"], description: "My methodology for testing the same prompt across 6 models. Includes scoring sheet and comparison template.", use_cases: ["Research"], monetisation_type: "free", status: "approved" },
      { key: "c17", creator: "chen", title: "Gemini vs Claude for Long Document Analysis", content_type: "guide", difficulty: "intermediate", ai_tools: ["Gemini", "Claude"], description: "Tested both on 50-page documents. Here are the results with accuracy scores.", use_cases: ["Research", "Learning"], monetisation_type: "free", status: "approved" },
      { key: "c18", creator: "chen", title: "The Prompt Versioning System", content_type: "blueprint", difficulty: "intermediate", ai_tools: ["ChatGPT", "Claude"], description: "A system for tracking prompt iterations, A/B testing results, and version history.", use_cases: ["Research", "Business"], monetisation_type: "free", status: "approved" },
      // isabelle — 2 items
      { key: "c19", creator: "isabelle", title: "AI for Non-Techies: Getting Started Without Code", content_type: "guide", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "The guide I wish I had when I started. No jargon. No code. Just practical steps.", use_cases: ["Learning", "Business"], monetisation_type: "free", status: "approved" },
      { key: "c20", creator: "isabelle", title: "Small Business Email Templates with AI", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "10 email templates for small business owners. Customer service, invoicing, follow-ups — all AI-generated.", use_cases: ["Business", "Email"], monetisation_type: "free", status: "approved" },
      // One pending item
      { key: "c21", creator: "sofia", title: "TikTok Hook Formula Prompt (Draft)", content_type: "prompt-file", difficulty: "beginner", ai_tools: ["ChatGPT"], description: "Still testing this one — generates TikTok video hooks based on your niche.", use_cases: ["Social Media"], monetisation_type: "free", status: "pending" },
    ];

    const now = new Date();
    const contentInserts = contentDefs.map((c, i) => ({
      creator_id: users[c.creator],
      title: c.title,
      content_type: c.content_type,
      difficulty: c.difficulty,
      ai_tools: c.ai_tools,
      description: c.description,
      use_cases: c.use_cases,
      monetisation_type: c.monetisation_type,
      status: c.status,
      is_pwyw: c.is_pwyw ?? false,
      pwyw_enabled: c.pwyw_enabled ?? false,
      pwyw_floor_gbp: c.pwyw_floor_gbp ?? null,
      approved_at: c.status === "approved" ? new Date(now.getTime() - (contentDefs.length - i) * 86400000).toISOString() : null,
      created_at: new Date(now.getTime() - (contentDefs.length - i + 2) * 86400000).toISOString(),
    }));

    const { data: insertedContent, error: contentError } = await supabase.from("content_items").insert(contentInserts).select("id, title");
    if (contentError) throw new Error(`Content insert failed: ${contentError.message}`);

    const contentMap: Record<string, string> = {};
    contentDefs.forEach((c, i) => {
      contentMap[c.key] = insertedContent[i].id;
    });

    // ═══ CONTENT BLOCKS (one text block per item) ═══
    const blockInserts = contentDefs.filter(c => c.status === "approved").map((c) => ({
      content_id: contentMap[c.key],
      block_type: "text",
      position: 0,
      is_preview: true,
      text_content: c.description + "\n\nThis is a demo content block for prototyping purposes.",
    }));
    await supabase.from("content_blocks").insert(blockInserts);

    // ═══ MICROTAGS ═══
    const microtagAssignments: Record<string, string[]> = {
      c1: ["#no-coding", "#copy-paste-ready", "#tested-output-included"],
      c2: ["#no-coding", "#copy-paste-ready", "#multi-model"],
      c3: ["#step-by-step", "#screenshot-walkthrough", "#intermediate-friendly"],
      c4: ["#copy-paste-ready", "#no-coding", "#tested-output-included"],
      c5: ["#api-key-needed", "#step-by-step", "#screenshot-walkthrough"],
      c6: ["#api-key-needed", "#step-by-step", "#advanced-only"],
      c7: ["#no-coding", "#beginner-safe", "#step-by-step"],
      c8: ["#multi-model", "#tested-output-included", "#comparison-included"],
      c9: ["#api-key-needed", "#step-by-step", "#advanced-only"],
      c10: ["#api-key-needed", "#advanced-only", "#step-by-step"],
      c11: ["#no-coding", "#template-included", "#beginner-safe"],
      c12: ["#honest-review", "#no-coding", "#beginner-safe"],
      c13: ["#no-coding", "#copy-paste-ready", "#tested-output-included"],
      c14: ["#no-coding", "#step-by-step", "#template-included"],
      c15: ["#copy-paste-ready", "#no-coding", "#template-included"],
      c16: ["#multi-model", "#advanced-only", "#tested-output-included"],
      c17: ["#multi-model", "#comparison-included", "#tested-output-included"],
      c18: ["#step-by-step", "#template-included", "#intermediate-friendly"],
      c19: ["#no-coding", "#beginner-safe", "#step-by-step"],
      c20: ["#no-coding", "#copy-paste-ready", "#template-included"],
    };

    const microtagInserts = Object.entries(microtagAssignments).flatMap(([key, tags]) =>
      tags.map((tag) => ({ content_id: contentMap[key], tag }))
    );
    await supabase.from("content_microtags").insert(microtagInserts);

    // ═══ STEP 5 — VIEWS ═══
    const viewPairs: [string, string][] = [
      // c1 gets lots of views
      ["alex", "c1"], ["priya", "c1"], ["marcus", "c1"], ["sofia", "c1"], ["jamie", "c1"],
      ["chen", "c1"], ["sam", "c1"], ["power", "c1"], ["lurker", "c1"], ["devtest", "c1"],
      // c2 popular
      ["priya", "c2"], ["marcus", "c2"], ["sofia", "c2"], ["sam", "c2"], ["power", "c2"],
      ["lurker", "c2"], ["isabelle", "c2"], ["newjoin", "c2"],
      // c5 popular
      ["alex", "c5"], ["marcus", "c5"], ["sofia", "c5"], ["jamie", "c5"], ["power", "c5"],
      ["sam", "c5"], ["devtest", "c5"],
      // spread across others
      ["sam", "c3"], ["power", "c3"], ["devtest", "c3"], ["priya", "c3"],
      ["power", "c4"], ["sam", "c4"], ["devtest", "c4"],
      ["power", "c6"], ["chen", "c6"], ["marcus", "c6"],
      ["sam", "c7"], ["isabelle", "c7"], ["newjoin", "c7"], ["power", "c7"],
      ["power", "c8"], ["alex", "c8"], ["sofia", "c8"],
      ["power", "c9"], ["priya", "c9"],
      ["power", "c10"], ["alex", "c10"],
      ["sam", "c11"], ["priya", "c11"], ["isabelle", "c11"], ["newjoin", "c11"],
      ["sam", "c12"], ["marcus", "c12"], ["isabelle", "c12"],
      ["sam", "c13"], ["power", "c13"], ["isabelle", "c13"],
      ["power", "c14"], ["priya", "c14"], ["chen", "c14"],
      ["power", "c15"], ["sam", "c15"],
      ["power", "c16"], ["alex", "c16"], ["marcus", "c16"],
      ["power", "c17"], ["alex", "c17"],
      ["power", "c18"], ["priya", "c18"],
      ["sam", "c19"], ["lurker", "c19"], ["newjoin", "c19"], ["power", "c19"],
      ["sam", "c20"], ["isabelle", "c20"], ["newjoin", "c20"],
    ];

    await supabase.from("content_views").insert(
      viewPairs.map(([u, c]) => ({ user_id: users[u], content_id: contentMap[c] }))
    );

    // Update view_count from actual rows
    const viewCounts: Record<string, number> = {};
    for (const [, c] of viewPairs) {
      viewCounts[c] = (viewCounts[c] || 0) + 1;
    }
    await Promise.all(
      Object.entries(viewCounts).map(([key, count]) =>
        supabase.from("content_items").update({ view_count: count }).eq("id", contentMap[key])
      )
    );

    // ═══ STEP 6 — DOWNLOADS ═══
    const downloadPairs: [string, string][] = [
      ["priya", "c1"], ["marcus", "c1"], ["sam", "c1"], ["power", "c1"],
      ["sofia", "c1"], ["chen", "c1"], ["devtest", "c1"],
      ["sam", "c2"], ["power", "c2"], ["sofia", "c2"], ["lurker", "c2"], ["isabelle", "c2"],
      ["power", "c3"], ["sam", "c3"], ["devtest", "c3"],
      ["power", "c4"], ["sam", "c4"],
      ["alex", "c5"], ["marcus", "c5"], ["power", "c5"], ["sam", "c5"], ["devtest", "c5"],
      ["power", "c6"], ["chen", "c6"],
      ["sam", "c7"], ["newjoin", "c7"], ["power", "c7"],
      ["power", "c8"], ["alex", "c8"],
      ["power", "c9"],
      ["power", "c10"],
      ["sam", "c11"], ["isabelle", "c11"], ["newjoin", "c11"],
      ["sam", "c12"], ["marcus", "c12"],
      ["sam", "c13"], ["power", "c13"],
      ["power", "c14"], ["priya", "c14"],
      ["power", "c15"],
      ["power", "c16"], ["alex", "c16"],
      ["power", "c17"],
      ["power", "c18"],
      ["sam", "c19"], ["newjoin", "c19"], ["power", "c19"],
      ["sam", "c20"], ["newjoin", "c20"],
    ];

    await supabase.from("downloads").insert(
      downloadPairs.map(([u, c]) => ({ user_id: users[u], content_id: contentMap[c] }))
    );

    // Update download_count from actual rows
    const dlCounts: Record<string, number> = {};
    for (const [, c] of downloadPairs) {
      dlCounts[c] = (dlCounts[c] || 0) + 1;
    }
    await Promise.all(
      Object.entries(dlCounts).map(([key, count]) =>
        supabase.from("content_items").update({ download_count: count }).eq("id", contentMap[key])
      )
    );

    // ═══ STEP 7 — RATINGS ═══
    const ratings: [string, string, number][] = [
      ["priya", "c1", 5], ["marcus", "c1", 4], ["sam", "c1", 5], ["power", "c1", 4], ["chen", "c1", 5],
      ["sam", "c2", 4], ["power", "c2", 5], ["sofia", "c2", 4],
      ["power", "c3", 4], ["sam", "c3", 3],
      ["power", "c5", 5], ["marcus", "c5", 4], ["sam", "c5", 4],
      ["power", "c6", 5], ["chen", "c6", 4],
      ["sam", "c7", 5], ["newjoin", "c7", 4],
      ["power", "c8", 5], ["alex", "c8", 4],
      ["power", "c9", 4],
      ["sam", "c11", 4], ["isabelle", "c11", 5],
      ["sam", "c12", 4],
      ["power", "c14", 5],
      ["power", "c16", 5], ["alex", "c16", 5],
      ["sam", "c19", 5], ["newjoin", "c19", 4], ["power", "c19", 4],
      ["sam", "c20", 4],
    ];

    await supabase.from("content_ratings").insert(
      ratings.map(([u, c, r]) => ({ user_id: users[u], content_id: contentMap[c], rating: r }))
    );

    // Update avg_rating and rating_count from actual rows
    const ratingAgg: Record<string, { sum: number; count: number }> = {};
    for (const [, c, r] of ratings) {
      if (!ratingAgg[c]) ratingAgg[c] = { sum: 0, count: 0 };
      ratingAgg[c].sum += r;
      ratingAgg[c].count += 1;
    }
    await Promise.all(
      Object.entries(ratingAgg).map(([key, { sum, count }]) =>
        supabase.from("content_items").update({
          avg_rating: Math.round((sum / count) * 100) / 100,
          rating_count: count,
          star_rating: Math.round((sum / count) * 100) / 100,
        }).eq("id", contentMap[key])
      )
    );

    // ═══ STEP 8 — COMMENTS ═══
    const comments: [string, string, string][] = [
      ["sam", "c1", "Used this for my freelance outreach. Got 3 replies in the first week."],
      ["power", "c1", "Works well but you need to tweak the tone for B2B vs B2C."],
      ["priya", "c1", "Solid prompt. I integrated it into my Zapier workflow."],
      ["power", "c2", "The LinkedIn captions are way better than the Instagram ones. Needs work on IG."],
      ["sam", "c2", "Simple and effective. Saved me an hour every week."],
      ["power", "c5", "This is exactly what I needed. Set it up in 20 minutes."],
      ["sam", "c7", "Finally a guide that doesn't assume I know what an API is."],
      ["newjoin", "c7", "This was my first download on the platform. Very helpful."],
      ["power", "c8", "Interesting comparison. Claude won on the research tasks in my testing too."],
      ["alex", "c8", "Great methodology. Would love to see Gemini 2.0 added."],
      ["sam", "c11", "I've been using this calendar for 3 months straight. Game changer."],
      ["marcus", "c12", "Refreshing to see someone post their failures. More of this."],
      ["sam", "c19", "This is the guide I needed when I started. Bookmarked."],
      ["newjoin", "c19", "Thank you for writing this without jargon."],
    ];

    const commentInserts = comments.map(([u, c, text]) => ({
      user_id: users[u], content_id: contentMap[c], text,
    }));
    await supabase.from("content_comments").insert(commentInserts);

    // comment_count is updated by trigger, but let's set it from actual rows
    const commentCounts: Record<string, number> = {};
    for (const [, c] of comments) {
      commentCounts[c] = (commentCounts[c] || 0) + 1;
    }
    await Promise.all(
      Object.entries(commentCounts).map(([key, count]) =>
        supabase.from("content_items").update({ comment_count: count }).eq("id", contentMap[key])
      )
    );

    // ═══ STEP 9 — VERIFICATIONS ═══
    const verifications: [string, string, string][] = [
      ["priya", "c1", "ChatGPT"], ["marcus", "c1", "ChatGPT"], ["sam", "c1", "ChatGPT"],
      ["power", "c1", "ChatGPT"], ["chen", "c1", "ChatGPT"],
      ["sam", "c2", "ChatGPT"], ["power", "c2", "Claude"], ["sofia", "c2", "ChatGPT"],
      ["power", "c5", "Zapier"], ["marcus", "c5", "Zapier"],
      ["power", "c8", "Claude"], ["alex", "c8", "Claude"],
      ["sam", "c11", "ChatGPT"], ["isabelle", "c11", "ChatGPT"],
      ["sam", "c19", "ChatGPT"], ["newjoin", "c19", "ChatGPT"],
    ];

    await supabase.from("content_verifications").insert(
      verifications.map(([u, c, tool]) => ({
        user_id: users[u], content_id: contentMap[c], ai_tool_used: tool,
      }))
    );

    // Update verification counts
    const verifCounts: Record<string, number> = {};
    for (const [, c] of verifications) {
      verifCounts[c] = (verifCounts[c] || 0) + 1;
    }
    await Promise.all(
      Object.entries(verifCounts).map(([key, count]) =>
        supabase.from("content_items").update({
          verification_count: count,
          is_verified: count >= 5,
        }).eq("id", contentMap[key])
      )
    );

    // ═══ STEP 10 — COLLECTIONS ═══
    const collectionDefs = [
      { owner: "alex", title: "Best Prompts for Beginners", description: "My curated starter pack for anyone new to prompt engineering.", visibility: "public", items: ["c1", "c2", "c11", "c13", "c20"] },
      { owner: "priya", title: "Automation Essentials", description: "Everything you need to start automating with AI.", visibility: "public", items: ["c5", "c6", "c7", "c14"] },
      { owner: "power", title: "My Favourites", description: "The content I keep coming back to.", visibility: "public", items: ["c1", "c5", "c8", "c16", "c19"] },
      { owner: "sofia", title: "Content Creator Toolkit", description: "AI tools and prompts for content creators.", visibility: "public", items: ["c2", "c11", "c13", "c4"] },
      { owner: "chen", title: "Research & Testing", description: "Resources for serious AI testing.", visibility: "unlisted", items: ["c8", "c16", "c17", "c18"] },
    ];

    for (const col of collectionDefs) {
      const slug = col.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const { data: inserted } = await supabase.from("collections").insert({
        owner_id: users[col.owner],
        title: col.title,
        description: col.description,
        visibility: col.visibility,
        is_public: col.visibility === "public",
        slug,
        item_count: col.items.length,
      }).select("id").single();

      if (inserted) {
        await supabase.from("collection_items").insert(
          col.items.map((cKey, idx) => ({
            collection_id: inserted.id,
            content_id: contentMap[cKey],
            added_by: users[col.owner],
            position: idx,
          }))
        );
      }
    }

    // ═══ STEP 11 — COLLECTION FOLLOWS ═══
    // Fetch collections to get IDs
    const { data: allCollections } = await supabase.from("collections").select("id, title, owner_id");
    const colByTitle = (t: string) => allCollections?.find((c: any) => c.title === t)?.id;

    const colFollows: [string, string][] = [
      ["sam", "Best Prompts for Beginners"],
      ["power", "Best Prompts for Beginners"],
      ["newjoin", "Best Prompts for Beginners"],
      ["lurker", "Best Prompts for Beginners"],
      ["power", "Automation Essentials"],
      ["jamie", "Automation Essentials"],
      ["sam", "Automation Essentials"],
      ["alex", "Content Creator Toolkit"],
      ["sam", "Content Creator Toolkit"],
      ["power", "My Favourites"],
    ];

    const colFollowInserts = colFollows
      .filter(([, title]) => colByTitle(title))
      .map(([u, title]) => ({
        follower_id: users[u],
        collection_id: colByTitle(title)!,
      }));
    if (colFollowInserts.length > 0) {
      await supabase.from("collection_follows").insert(colFollowInserts);
    }

    // Update follower_count on collections
    const colFollowCounts: Record<string, number> = {};
    for (const [, title] of colFollows) {
      const cid = colByTitle(title);
      if (cid) colFollowCounts[cid] = (colFollowCounts[cid] || 0) + 1;
    }
    await Promise.all(
      Object.entries(colFollowCounts).map(([id, count]) =>
        supabase.from("collections").update({ follower_count: count }).eq("id", id)
      )
    );

    // ═══ STEP 12 — CURATOR RECOMMENDATIONS ═══
    const { data: alexCurator } = await supabase.from("curators").select("id").eq("user_id", users.alex).single();
    const { data: chenCurator } = await supabase.from("curators").select("id").eq("user_id", users.chen).single();

    if (alexCurator && chenCurator) {
      await supabase.from("curator_recommendations").insert([
        { curator_id: alexCurator.id, content_id: contentMap.c5, recommendation_text: "Priya's automation setup is the real deal. I've recommended it to three clients already." },
        { curator_id: alexCurator.id, content_id: contentMap.c19, recommendation_text: "If you're not technical, start here. Isabelle writes like a normal human being." },
        { curator_id: chenCurator.id, content_id: contentMap.c8, recommendation_text: "Marcus did the comparison I was too lazy to write. Thorough and fair." },
        { curator_id: chenCurator.id, content_id: contentMap.c1, recommendation_text: "Battle-tested cold email prompt. I verified it across ChatGPT and Claude — works on both." },
      ]);

      // Update has_curator_recommendation
      await Promise.all(
        [contentMap.c5, contentMap.c19, contentMap.c8, contentMap.c1].map((id) =>
          supabase.from("content_items").update({ has_curator_recommendation: true }).eq("id", id)
        )
      );
    }

    // ═══ STEP 13 — USER INTERACTIONS (FYP data) ═══
    const interactions: [string, string, string][] = [
      ["sam", "c1", "download"], ["sam", "c2", "download"], ["sam", "c7", "download"],
      ["sam", "c11", "download"], ["sam", "c19", "download"],
      ["power", "c1", "download"], ["power", "c3", "download"], ["power", "c5", "download"],
      ["power", "c8", "download"], ["power", "c16", "download"],
      ["power", "c1", "bookmark"], ["power", "c5", "bookmark"], ["power", "c8", "bookmark"],
      ["sam", "c1", "bookmark"], ["sam", "c19", "bookmark"],
      ["newjoin", "c7", "download"], ["newjoin", "c19", "download"],
      ["lurker", "c1", "view"], ["lurker", "c2", "view"],
    ];

    await supabase.from("user_interactions").insert(
      interactions.map(([u, c, type]) => ({
        user_id: users[u],
        content_id: contentMap[c],
        interaction_type: type,
      }))
    );

    // ═══ STEP 14 — TIPS ═══
    const tips: [string, string, string][] = [
      ["power", "c1", "Add 'Reply as if you are the recipient's colleague' to the prompt for better tone."],
      ["sam", "c5", "You can use Webhooks by Zapier instead of the Gmail trigger for faster processing."],
      ["chen", "c8", "Try adding 'Think step by step' to both models for fairer comparison."],
      ["isabelle", "c19", "I printed this guide and stuck it on my wall. That helpful."],
    ];

    await supabase.from("content_tips").insert(
      tips.map(([u, c, text]) => ({
        user_id: users[u], content_id: contentMap[c], text,
      }))
    );

    // ═══ STEP 15 — LIBRARY ENTRIES ═══
    const libraryPairs: [string, string][] = [
      ["sam", "c1"], ["sam", "c2"], ["sam", "c7"], ["sam", "c11"], ["sam", "c19"], ["sam", "c20"],
      ["power", "c1"], ["power", "c5"], ["power", "c8"], ["power", "c9"], ["power", "c16"],
      ["newjoin", "c7"], ["newjoin", "c19"],
      ["lurker", "c1"],
      ["devtest", "c1"], ["devtest", "c5"],
    ];

    await supabase.from("user_library").insert(
      libraryPairs.map(([u, c]) => ({
        user_id: users[u], content_id: contentMap[c],
      }))
    );

    return new Response(
      JSON.stringify({ message: "Demo data seeded successfully", users: Object.keys(users).length, content: contentDefs.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
