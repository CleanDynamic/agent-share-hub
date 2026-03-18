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
    const followPairs: [string, string][] = [
      // Regular users following creators
      ["sam", "alex"], ["sam", "isabelle"], ["sam", "sofia"],
      ["power", "alex"], ["power", "priya"], ["power", "marcus"], ["power", "sofia"], ["power", "jamie"], ["power", "chen"], ["power", "isabelle"],
      ["lurker", "chen"], ["lurker", "isabelle"],
      ["newjoin", "isabelle"],
      ["devtest", "alex"], ["devtest", "priya"], ["devtest", "marcus"], ["devtest", "sofia"], ["devtest", "jamie"], ["devtest", "chen"], ["devtest", "isabelle"],
      // Creators following each other
      ["alex", "chen"], ["alex", "isabelle"], ["alex", "sofia"],
      ["priya", "jamie"], ["priya", "marcus"], ["priya", "chen"],
      ["marcus", "chen"], ["marcus", "alex"], ["marcus", "sofia"],
      ["sofia", "isabelle"], ["sofia", "alex"], ["sofia", "priya"],
      ["jamie", "priya"], ["jamie", "marcus"],
      ["chen", "alex"], ["chen", "marcus"], ["chen", "sofia"],
      ["isabelle", "sofia"], ["isabelle", "alex"],
    ];

    await supabase.from("follows").insert(
      followPairs.map(([follower, following]) => ({
        follower_id: users[follower],
        following_id: users[following],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
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

    // ═══ STEP 4 — CONTENT ITEMS (18 items across 9 content types) ═══
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    const contentDefs = [
      { key: "c1", creator: "alex", title: "The Email Rewriter", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "Turns any rough email draft into a professional, clear message in seconds.", use_cases: ["Email","Productivity"], monetisation_type: "free", donation_enabled: true, current_version: "1.2", approved_days: 25 },
      { key: "c2", creator: "priya", title: "Weekly Report Generator — Zapier + ChatGPT", content_type: "Workflow Template", difficulty: "Intermediate", ai_tools: ["ChatGPT","Zapier"], description: "Pulls data from Google Sheets every Monday and emails a formatted weekly summary.", use_cases: ["Business","Productivity"], monetisation_type: "paid", price_gbp: 4.99, current_version: "2.0", approved_days: 18 },
      { key: "c3", creator: "marcus", title: "The Research Assistant Blueprint", content_type: "Agent Blueprint", difficulty: "Beginner", ai_tools: ["ChatGPT","Claude","Gemini"], description: "A complete setup for turning any AI into a research assistant that summarises and cites sources.", use_cases: ["Research","Learning"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 12 },
      { key: "c4", creator: "sofia", title: "How to Write Prompts That Actually Work", content_type: "Prompt Tutorial", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "A step-by-step guide to writing better AI prompts yourself — with before and after examples.", use_cases: ["Learning","Productivity"], monetisation_type: "free", donation_enabled: true, current_version: "1.1", approved_days: 20 },
      { key: "c5", creator: "jamie", title: "Connect ChatGPT to Gmail in 15 Minutes", content_type: "Integration Guide", difficulty: "Beginner", ai_tools: ["ChatGPT","Zapier"], description: "A tested step-by-step guide connecting ChatGPT to Gmail using Zapier — no code needed.", use_cases: ["Email","Productivity"], monetisation_type: "free", donation_enabled: false, current_version: "1.0", approved_days: 8 },
      { key: "c6", creator: "chen", title: "How to Test If Your AI Prompt Actually Works", content_type: "Evaluation Framework", difficulty: "Intermediate", ai_tools: ["Any Tool"], description: "A scoring framework to evaluate AI output quality — with test inputs and a rubric.", use_cases: ["Research","Learning","Business"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 15 },
      { key: "c7", creator: "isabelle", title: "Why My Customer Service Bot Kept Apologising for Everything", content_type: "Failure Library", difficulty: "Beginner", ai_tools: ["ChatGPT","Claude"], description: "What went wrong when I built a customer service prompt and how I fixed the over-apologising problem.", use_cases: ["Business","Productivity"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 5 },
      { key: "c8", creator: "alex", title: "Which AI Should You Use — And Does It Matter?", content_type: "Model Config Guide", difficulty: "Beginner", ai_tools: ["ChatGPT","Claude","Gemini"], description: "A plain English comparison of ChatGPT, Claude, and Gemini with one example use case each.", use_cases: ["Learning"], monetisation_type: "free", donation_enabled: false, current_version: "1.0", approved_days: 30 },
      { key: "c9", creator: "priya", title: "The Full Content Calendar Stack", content_type: "Agent Stack", difficulty: "Advanced", ai_tools: ["ChatGPT","Zapier","Make"], description: "A complete multi-tool system that plans, writes, and schedules a month of social content automatically.", use_cases: ["Social Media","Content","Business"], monetisation_type: "paid", price_gbp: 9.99, current_version: "1.0", approved_days: 10 },
      { key: "c10", creator: "marcus", title: "The Meeting Notes Organiser", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "Paste your raw meeting notes and get a structured summary with action items and owners.", use_cases: ["Business","Productivity"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 22 },
      { key: "c11", creator: "sofia", title: "I Tried to Automate My Newsletter and Made It Worse", content_type: "Failure Library", difficulty: "Beginner", ai_tools: ["ChatGPT"], description: "How my AI newsletter assistant started writing in a completely different voice and how I fixed it.", use_cases: ["Content","Social Media"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 3 },
      { key: "c12", creator: "chen", title: "The Cross-Model Prompt Tester", content_type: "Prompt File", difficulty: "Intermediate", ai_tools: ["ChatGPT","Claude","Gemini"], description: "Tests any prompt across ChatGPT, Claude, and Gemini simultaneously and compares the outputs.", use_cases: ["Research","Learning"], monetisation_type: "free", donation_enabled: true, current_version: "2.1", approved_days: 28 },
      { key: "c13", creator: "jamie", title: "The Idea Unkiller", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "Paste any idea you think is bad. This prompt tells you what is actually good about it.", use_cases: ["Business","Content","Productivity"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 6 },
      { key: "c14", creator: "isabelle", title: "The Only AI Skill You Actually Need as a Small Business Owner", content_type: "Prompt Tutorial", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "A practical tutorial on writing role prompts — the single most effective technique for non-technical users.", use_cases: ["Business","Learning"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 14 },
      { key: "c15", creator: "chen", title: "The Competitor Intelligence Blueprint", content_type: "Agent Blueprint", difficulty: "Intermediate", ai_tools: ["ChatGPT","Zapier"], description: "A weekly setup for tracking what your competitors are publishing and summarising it automatically.", use_cases: ["Business","Research"], monetisation_type: "paid", price_gbp: 6.99, current_version: "1.0", approved_days: 9 },
      { key: "c16", creator: "alex", title: "The Instant Explainer", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["Any Tool"], description: "Explains any complex topic in plain English that a 12-year-old could understand.", use_cases: ["Learning","Research"], monetisation_type: "free", donation_enabled: false, current_version: "1.0", approved_days: 35 },
      { key: "c17", creator: "isabelle", title: "The Time I Let AI Write My Entire Email Newsletter and Lost 40 Subscribers", content_type: "Failure Library", difficulty: "Beginner", ai_tools: ["ChatGPT"], description: "What happened when I removed myself completely from my newsletter process and what I learned.", use_cases: ["Content","Business"], monetisation_type: "free", donation_enabled: true, current_version: "1.0", approved_days: 1 },
      { key: "c18", creator: "marcus", title: "When to Use Claude vs ChatGPT — A Decision Framework", content_type: "Model Config Guide", difficulty: "Intermediate", ai_tools: ["ChatGPT","Claude"], description: "A practical framework for choosing between Claude and ChatGPT based on your actual task.", use_cases: ["Research","Learning","Business"], monetisation_type: "free", donation_enabled: false, current_version: "1.0", approved_days: 17 },
    ];

    const contentInserts = contentDefs.map((c) => ({
      creator_id: users[c.creator],
      title: c.title,
      content_type: c.content_type,
      difficulty: c.difficulty,
      ai_tools: c.ai_tools,
      description: c.description,
      use_cases: c.use_cases,
      monetisation_type: c.monetisation_type,
      donation_enabled: c.donation_enabled ?? false,
      price_gbp: (c as any).price_gbp ?? null,
      current_version: c.current_version,
      status: "approved",
      approved_at: daysAgo(c.approved_days),
      created_at: daysAgo(c.approved_days + 2),
    }));

    const { data: insertedContent, error: contentError } = await supabase.from("content_items").insert(contentInserts).select("id, title");
    if (contentError) throw new Error(`Content insert failed: ${contentError.message}`);

    const contentMap: Record<string, string> = {};
    contentDefs.forEach((c, i) => {
      contentMap[c.key] = insertedContent[i].id;
    });

    // ═══ CONTENT BLOCKS (full blocks per item) ═══
    const allBlocks: any[] = [
      // Post 1 — The Email Rewriter
      { content_id: contentMap.c1, block_type: "text", position: 1, is_preview: true, text_content: "Paste this into any AI tool and it rewrites your email to sound professional, clear, and direct. Works in ChatGPT, Claude, Gemini, or any instruction-following AI.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c1, block_type: "text", position: 2, is_preview: false, text_content: "SYSTEM PROMPT — EMAIL REWRITER\n\nYou are an expert business writer. When the user gives you a rough email draft, you rewrite it to be: professional in tone, concise (no waffle), clear in its ask, and easy to read. Keep the core message. Improve the delivery. Output the rewritten email only — no commentary.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c1, block_type: "text", position: 3, is_preview: false, text_content: "HOW TO USE:\n1. Copy everything in Block 2 above\n2. Open ChatGPT, Claude, Gemini, or any AI\n3. Paste it as your first message\n4. Then paste your rough email draft\n5. The AI rewrites it immediately", formatting: {type:"numbers",items:["Copy everything in Block 2 above","Open ChatGPT, Claude, Gemini, or any AI","Paste it as your first message","Then paste your rough email draft","The AI rewrites it immediately"]} },
      // Post 2 — Weekly Report Generator
      { content_id: contentMap.c2, block_type: "text", position: 1, is_preview: true, text_content: "This Zapier workflow runs automatically every Monday morning. It reads your Google Sheet, sends the data to ChatGPT, and emails you a clean formatted summary. Set it up once and it runs forever.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c2, block_type: "text", position: 2, is_preview: false, text_content: "WHAT YOU NEED:\n- A free Zapier account\n- A Google Sheets spreadsheet with your data\n- A ChatGPT account (free tier works)\n- A Gmail account to send from", formatting: {type:"bullets",items:["A free Zapier account","A Google Sheets spreadsheet with your data","A ChatGPT account (free tier works)","A Gmail account to send from"]} },
      { content_id: contentMap.c2, block_type: "text", position: 3, is_preview: false, text_content: "SETUP STEPS:\n1. Download the JSON file below\n2. Go to zapier.com and click Create Zap\n3. Click Import from file and upload the JSON\n4. Connect your Google Sheets account when prompted\n5. Connect your Gmail account when prompted\n6. Set the trigger time to Monday 8am your timezone\n7. Turn the Zap on", formatting: {type:"numbers",items:["Download the JSON file below","Go to zapier.com and click Create Zap","Click Import from file and upload the JSON","Connect your Google Sheets account when prompted","Connect your Gmail account when prompted","Set the trigger time to Monday 8am your timezone","Turn the Zap on"]} },
      { content_id: contentMap.c2, block_type: "file", position: 4, is_preview: false, file_name: "weekly-report-zapier-template.json", file_size_bytes: 2847, file_url: `/content-files/${users.priya}/post2/weekly-report-zapier-template.json` },
      // Post 3 — Research Assistant Blueprint
      { content_id: contentMap.c3, block_type: "text", position: 1, is_preview: true, text_content: "This blueprint turns any AI into a research assistant. Give it a topic and it finds key information, organises it by theme, and tells you which claims need verification. Works in ChatGPT, Claude, or Gemini.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c3, block_type: "text", position: 2, is_preview: false, text_content: "THE SYSTEM PROMPT:\n\nYou are a research assistant. When given a topic, you: 1) summarise the key facts in plain English, 2) organise findings into 3-5 clear themes, 3) flag any claims that are contested or need source verification, 4) suggest 3 follow-up questions. Always say when you are uncertain. Never fabricate sources.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c3, block_type: "text", position: 3, is_preview: false, text_content: "EXAMPLE COMMANDS TO TRY:\n- \"Research the pros and cons of remote work for small businesses\"\n- \"Summarise the main arguments for and against intermittent fasting\"\n- \"What are the key differences between Make and Zapier?\"", formatting: {type:"bullets",items:["\"Research the pros and cons of remote work for small businesses\"","\"Summarise the main arguments for and against intermittent fasting\"","\"What are the key differences between Make and Zapier?\""]} },
      // Post 4 — How to Write Prompts That Actually Work
      { content_id: contentMap.c4, block_type: "text", position: 1, is_preview: true, text_content: "Most AI prompts fail for the same three reasons. This tutorial teaches you to fix them. You will learn the four elements of a good prompt and how to apply them in any AI tool.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c4, block_type: "text", position: 2, is_preview: false, text_content: "THE THREE MISTAKES:\n\n1. Too vague — \"Write me something about marketing\" gives you nothing useful. You need to specify what, for whom, and in what format.\n\n2. No role — AI performs dramatically better when you tell it what kind of expert to be. \"You are a senior copywriter\" changes the whole output.\n\n3. No format — If you want bullet points, say bullet points. If you want 200 words, say 200 words. The AI will not guess.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c4, block_type: "text", position: 3, is_preview: false, text_content: "THE FOUR ELEMENTS OF A GOOD PROMPT:\n\n1. ROLE — who the AI should be\n2. TASK — what you want it to do\n3. CONTEXT — relevant background information\n4. FORMAT — how you want the output\n\nBEFORE: \"Write a LinkedIn post about AI\"\nAFTER: \"You are a B2B copywriter. Write a 150-word LinkedIn post for a small business owner explaining one practical way AI can save them time this week. Conversational tone. End with a question.\"", formatting: {type:"paragraph"} },
      // Post 5 — Connect ChatGPT to Gmail
      { content_id: contentMap.c5, block_type: "text", position: 1, is_preview: true, text_content: "This guide shows you how to connect ChatGPT to Gmail using Zapier. When an email arrives with a specific label, Zapier sends it to ChatGPT, which drafts a reply and saves it to your drafts folder. Tested and working as of this month.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c5, block_type: "text", position: 2, is_preview: false, text_content: "WHAT YOU NEED:\n- Gmail account\n- Free Zapier account (zapier.com)\n- ChatGPT account (free tier works)\n- About 15 minutes", formatting: {type:"bullets",items:["Gmail account","Free Zapier account (zapier.com)","ChatGPT account (free tier works)","About 15 minutes"]} },
      { content_id: contentMap.c5, block_type: "text", position: 3, is_preview: false, text_content: "STEP BY STEP:\n1. Log into Zapier and click Create Zap\n2. Set Trigger: Gmail — New email matching search\n3. In the search field enter: label:needs-reply\n4. Set Action: ChatGPT — Send a message\n5. In the message field paste: \"Draft a professional reply to this email: [Email Body]\"\n6. Add second Action: Gmail — Create draft\n7. Map the ChatGPT response to the draft body\n8. Turn on your Zap\n9. In Gmail, label any email needs-reply and watch the draft appear", formatting: {type:"numbers",items:["Log into Zapier and click Create Zap","Set Trigger: Gmail — New email matching search","In the search field enter: label:needs-reply","Set Action: ChatGPT — Send a message","In the message field paste: \"Draft a professional reply to this email: [Email Body]\"","Add second Action: Gmail — Create draft","Map the ChatGPT response to the draft body","Turn on your Zap","In Gmail, label any email needs-reply and watch the draft appear"]} },
      // Post 6 — How to Test If Your AI Prompt Actually Works
      { content_id: contentMap.c6, block_type: "text", position: 1, is_preview: true, text_content: "Most people test their AI prompts by running them once and deciding if they \"feel right.\" This framework gives you a repeatable scoring process so you know if your setup is genuinely working before you rely on it.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c6, block_type: "text", position: 2, is_preview: false, text_content: "THE 5-POINT SCORING RUBRIC:\n\n1. Accuracy — Does the output contain factually correct information? (1 = multiple errors, 5 = fully accurate)\n2. Relevance — Does it address what was asked? (1 = off-topic, 5 = precisely on target)\n3. Format — Does it match the requested structure? (1 = ignored format, 5 = perfect format)\n4. Tone — Does it match the requested voice? (1 = wrong tone, 5 = perfect tone)\n5. Usefulness — Could you use this output directly? (1 = needs complete rewrite, 5 = use as-is)\n\nTarget score: 20+ out of 25 before you rely on a prompt in production.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c6, block_type: "text", position: 3, is_preview: false, text_content: "TEST METHODOLOGY:\n1. Run your prompt with 5 different inputs (not just the ideal case)\n2. Score each output using the rubric above\n3. Calculate your average score\n4. Any category averaging below 3 needs prompt revision\n5. Re-run after revision and compare scores", formatting: {type:"numbers",items:["Run your prompt with 5 different inputs (not just the ideal case)","Score each output using the rubric above","Calculate your average score","Any category averaging below 3 needs prompt revision","Re-run after revision and compare scores"]} },
      // Post 7 — Why My Customer Service Bot Kept Apologising
      { content_id: contentMap.c7, block_type: "text", position: 1, is_preview: true, text_content: "I built a customer service prompt for my online shop. It worked perfectly in testing. Then I turned it on and every single response started with \"I am so sorry to hear that.\" Even when the customer was just asking for store hours.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c7, block_type: "text", position: 2, is_preview: false, text_content: "WHAT I DID WRONG:\n\nMy original prompt said: \"You are a helpful customer service assistant. Always be empathetic and understanding.\"\n\nThe word \"empathetic\" trained the AI to express sympathy regardless of context. It treated every message as a complaint requiring emotional comfort. A customer asking \"what are your opening hours?\" got: \"I am so sorry you are having difficulty finding our opening times...\"", formatting: {type:"paragraph"} },
      { content_id: contentMap.c7, block_type: "text", position: 3, is_preview: false, text_content: "THE FIX:\n\nI replaced \"Always be empathetic and understanding\" with:\n\"Match your tone to the customer message. For simple questions: be brief and direct. For complaints: be calm and solution-focused. Only express sympathy when the customer expresses a genuine problem.\"\n\nThe over-apologising stopped immediately.\n\nWHAT THIS MEANS FOR YOU:\nVague emotional instructions like \"be empathetic\" or \"be friendly\" override everything else in your prompt. Be specific about when and how to express emotion, not just that you want the AI to feel things.", formatting: {type:"paragraph"} },
      // Post 8 — Which AI Should You Use
      { content_id: contentMap.c8, block_type: "text", position: 1, is_preview: true, text_content: "The most common question from people new to AI: does it matter which one I use? Honest answer: for most everyday tasks, no. But for specific jobs, yes. Here is what you actually need to know.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c8, block_type: "text", position: 2, is_preview: false, text_content: "CHATGPT (OpenAI)\nBest for: writing tasks, browsing the web, image generation, coding help\nFree tier: yes, GPT-4o available on free plan with limits\nBest example use: \"Write me a social media post about [topic]\"\n\nCLAUDE (Anthropic)\nBest for: long documents, careful reasoning, following complex instructions precisely\nFree tier: yes, Claude Sonnet available free\nBest example use: \"Read this 20-page contract and summarise the key obligations\"\n\nGEMINI (Google)\nBest for: anything integrated with Google Workspace — Gmail, Docs, Sheets\nFree tier: yes, Gemini 1.5 Flash available free\nBest example use: \"Summarise my last 10 emails and tell me what needs a reply\"", formatting: {type:"paragraph"} },
      { content_id: contentMap.c8, block_type: "text", position: 3, is_preview: false, text_content: "SIMPLE RULE:\nIf you already use Google products — start with Gemini.\nIf you need to read or write long documents — use Claude.\nFor everything else — ChatGPT is the safest default.\n\nAll prompt files on NeoScale AI are tested to work across all three unless specified otherwise.", formatting: {type:"paragraph"} },
      // Post 9 — The Full Content Calendar Stack
      { content_id: contentMap.c9, block_type: "text", position: 1, is_preview: true, text_content: "This is a complete three-tool system. You give it your brand, your topics, and your posting schedule once. It generates a month of social media content, gets your approval, and schedules everything automatically. Setup takes about an hour. After that it runs itself.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c9, block_type: "text", position: 2, is_preview: false, text_content: "THE THREE COMPONENTS:\n\n1. CONTENT PLANNER (ChatGPT prompt)\nGenerates 30 post ideas from your brand brief and content pillars. You review and approve the list.\n\n2. CONTENT WRITER (Make automation)\nFor each approved idea, sends it to ChatGPT with your brand voice prompt and writes the full post. Saves all drafts to a Google Sheet.\n\n3. SCHEDULER (Zapier automation)\nReads approved posts from the Google Sheet and schedules them to Buffer or Hootsuite on your preferred days and times.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c9, block_type: "text", position: 3, is_preview: false, text_content: "WHAT YOU NEED:\n- ChatGPT account (free works for planning, Pro recommended for writing)\n- Make account (free tier: 1000 operations/month)\n- Zapier account (free tier: 5 Zaps)\n- Buffer or Hootsuite account for scheduling\n- Google Sheets (free)\n\nAll files and prompts are in the blocks below.", formatting: {type:"bullets",items:["ChatGPT account (free works for planning, Pro recommended for writing)","Make account (free tier: 1000 operations/month)","Zapier account (free tier: 5 Zaps)","Buffer or Hootsuite account for scheduling","Google Sheets (free)"]} },
      // Post 10 — The Meeting Notes Organiser
      { content_id: contentMap.c10, block_type: "text", position: 1, is_preview: true, text_content: "Paste your messy meeting notes and this prompt turns them into a clean summary with action items, owners, and deadlines clearly listed. Works in any AI tool.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c10, block_type: "text", position: 2, is_preview: false, text_content: "SYSTEM PROMPT — MEETING NOTES ORGANISER\n\nYou are an executive assistant. When given raw meeting notes, you produce a structured summary in this exact format:\n\nMEETING SUMMARY\nDate: [extract from notes or write Unknown]\nAttendees: [list names mentioned]\n\nKEY DECISIONS\n[bullet list of decisions made]\n\nACTION ITEMS\n[table: Action | Owner | Deadline]\n\nNEXT MEETING\n[date if mentioned, or \"Not scheduled\"]\n\nBe concise. Extract only what is in the notes. Do not add information that was not mentioned.", formatting: {type:"paragraph"} },
      // Post 11 — I Tried to Automate My Newsletter
      { content_id: contentMap.c11, block_type: "text", position: 1, is_preview: true, text_content: "I write a weekly newsletter about content creation. I built a ChatGPT prompt to help draft it faster. Three weeks in, my readers started emailing me saying the newsletter \"sounds different.\" They were right. The AI had gradually taken over my voice entirely.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c11, block_type: "text", position: 2, is_preview: false, text_content: "WHAT WENT WRONG:\n\nI used the same ChatGPT conversation for all three newsletters without clearing it. ChatGPT was building on its own previous responses rather than on my actual writing. By week three it was writing in a formal corporate tone that sounded nothing like me.\n\nThe lesson: AI does not remember your voice between sessions. It only remembers within the same conversation window.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c11, block_type: "text", position: 3, is_preview: false, text_content: "THE FIX:\n\nI added a voice sample to my system prompt. The first block of my prompt is now 3 paragraphs copied from my best-performing newsletter. I told the AI: \"This is how I write. Match this voice exactly.\"\n\nI also start a fresh conversation every single week.\n\nThe newsletter sounds like me again.\n\nFOR YOU:\nIf you want AI to match your writing style, give it examples of your actual writing — not a description of your style. Show, do not tell.", formatting: {type:"paragraph"} },
      // Post 12 — The Cross-Model Prompt Tester
      { content_id: contentMap.c12, block_type: "text", position: 1, is_preview: true, text_content: "Run this prompt in ChatGPT, Claude, and Gemini. Then compare the three outputs side by side. It reveals which model handles your use case best so you stop guessing and start knowing.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c12, block_type: "text", position: 2, is_preview: false, text_content: "META-ANALYSIS PROMPT:\n\nYou are a prompt performance analyst. I will give you a prompt and a task. Run the task using that prompt, then evaluate your own output against these criteria:\n1. Accuracy (1-5): Is the information correct?\n2. Completeness (1-5): Did you cover everything asked?\n3. Format (1-5): Is the output well-structured?\n4. Readability (1-5): Is it easy to understand?\n\nEnd your response with a SCORES section showing your ratings and one sentence on your biggest weakness for this task.\n\nMy prompt: [PASTE YOUR PROMPT]\nMy task: [DESCRIBE THE TASK]", formatting: {type:"paragraph"} },
      // Post 13 — The Idea Unkiller
      { content_id: contentMap.c13, block_type: "text", position: 1, is_preview: true, text_content: "Most people use AI to improve good ideas. This prompt does the opposite — it finds the value in ideas you have already dismissed. Useful when you feel stuck or when brainstorming has stalled.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c13, block_type: "text", position: 2, is_preview: false, text_content: "SYSTEM PROMPT — IDEA UNKILLER\n\nYou are a lateral thinking consultant. When given an idea the user thinks is bad, your job is to:\n1. Identify every genuine strength in the idea (minimum 3)\n2. Identify what problem it could actually solve if the context were different\n3. Suggest one specific small version of the idea that could work right now\n4. Never dismiss the idea — find the kernel of value\n\nDo not tell the user their idea is good. Tell them what is specifically useful about it.", formatting: {type:"paragraph"} },
      // Post 14 — The Only AI Skill You Actually Need
      { content_id: contentMap.c14, block_type: "text", position: 1, is_preview: true, text_content: "You do not need to know anything technical about AI to get dramatically better results. You just need to learn one technique: telling the AI who to be. This tutorial is for people who run businesses and want practical AI help, not people who want to become prompt engineers.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c14, block_type: "text", position: 2, is_preview: false, text_content: "THE TECHNIQUE — ROLE PROMPTING:\n\nBefore you tell the AI what you want, tell it who it is.\n\nWITHOUT a role: \"Write a social media post for my bakery\"\nResult: Generic, safe, forgettable.\n\nWITH a role: \"You are a social media manager who specialises in local food businesses with a warm, community-focused voice. Write a social media post for my bakery announcing our new Saturday morning croissant special.\"\nResult: Specific, on-brand, usable.\n\nThe difference is the role. It takes 10 extra seconds and the output quality doubles.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c14, block_type: "text", position: 3, is_preview: false, text_content: "THREE ROLE PROMPTS TO COPY RIGHT NOW:\n\nFor writing: \"You are a professional copywriter who specialises in [your industry]. Your writing is clear, direct, and persuasive without being pushy.\"\n\nFor advice: \"You are a business consultant with 20 years experience advising small businesses in [your sector]. Give practical, specific advice not general principles.\"\n\nFor customer emails: \"You are a customer service manager known for resolving complaints quickly and leaving customers feeling valued. Respond to this email professionally.\"", formatting: {type:"paragraph"} },
      // Post 15 — The Competitor Intelligence Blueprint
      { content_id: contentMap.c15, block_type: "text", position: 1, is_preview: true, text_content: "This blueprint gives you a weekly digest of what your competitors published — blog posts, social updates, press releases — summarised by ChatGPT and delivered to your inbox every Monday. Never miss a competitor move again.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c15, block_type: "text", position: 2, is_preview: false, text_content: "COMPONENTS:\n\n1. RSS Feed Monitor (Zapier)\nWatch your competitors RSS feeds. When a new item appears, Zapier triggers the next step.\n\n2. Summariser Prompt (ChatGPT)\n\"Summarise this article in 3 bullet points. Then answer: what is the key message, who is the target audience, and what does this tell us about their strategy?\"\n\n3. Weekly Digest Compiler (Zapier)\nCollect all weekly summaries into a Google Sheet. Every Monday at 8am, email the compiled sheet to you.", formatting: {type:"paragraph"} },
      // Post 16 — The Instant Explainer
      { content_id: contentMap.c16, block_type: "text", position: 1, is_preview: true, text_content: "Paste this into any AI and ask it to explain anything — a news story, a technical concept, a legal document. It comes back in plain English every time.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c16, block_type: "text", position: 2, is_preview: false, text_content: "SYSTEM PROMPT — THE INSTANT EXPLAINER\n\nExplain the following using only simple, everyday language. Write as if explaining to a curious 12-year-old who is smart but has no specialist knowledge. No jargon. No acronyms without explanation. Use real-world comparisons where helpful. Maximum 200 words. End with: \"In short: [one sentence summary].\"", formatting: {type:"paragraph"} },
      // Post 17 — The Time I Let AI Write My Entire Email Newsletter
      { content_id: contentMap.c17, block_type: "text", position: 1, is_preview: true, text_content: "I was busy. I told ChatGPT to write my entire weekly newsletter from scratch using only the topic I gave it. No voice sample. No examples. No editing from me. I published it immediately. I lost 40 subscribers in 48 hours.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c17, block_type: "text", position: 2, is_preview: false, text_content: "WHAT HAPPENED:\n\nThe newsletter was technically fine. It was accurate, well-structured, and covered the topic. But it had no opinion. No personal story. No moment where I said something that only I would say. It read like a Wikipedia summary.\n\nMy readers follow me because I am a small business owner who is honest about what works and what does not. ChatGPT wrote something professional and safe and completely missing the reason people signed up.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c17, block_type: "text", position: 3, is_preview: false, text_content: "WHAT I DO NOW:\n\nI write the first paragraph myself — always. The personal hook, the thing that happened to me this week, the opinion I actually hold. Then I hand the rest to AI with instructions to match that tone.\n\nAI writes the explanation. I write the point of view.\n\nNOBODY unsubscribed after I brought that back.\n\nFOR YOU:\nUse AI for the craft — structure, clarity, completeness. Keep the voice for yourself. That is the part nobody can replicate.", formatting: {type:"paragraph"} },
      // Post 18 — When to Use Claude vs ChatGPT
      { content_id: contentMap.c18, block_type: "text", position: 1, is_preview: true, text_content: "I have run the same prompts on both Claude and ChatGPT for 8 months. Here is the honest decision framework I use every day. Not which is better. Which is better for what.", formatting: {type:"paragraph"} },
      { content_id: contentMap.c18, block_type: "text", position: 2, is_preview: false, text_content: "USE CLAUDE WHEN:\n- You are working with a long document (contracts, reports, books)\n- You need the AI to follow a complex multi-step instruction exactly\n- You want careful, nuanced reasoning on a difficult question\n- You need it to stay in character through a long conversation\n\nUSE CHATGPT WHEN:\n- You need to browse the web for current information\n- You want to generate or edit images\n- You need to run code or analyse a spreadsheet\n- You want access to the largest plugin and GPT ecosystem", formatting: {type:"paragraph"} },
      { content_id: contentMap.c18, block_type: "text", position: 3, is_preview: false, text_content: "THE OVERLAP (both are equally good):\n- Writing tasks (emails, posts, summaries)\n- Brainstorming and ideation\n- Question answering on topics you know well enough to spot errors\n- Most everyday business tasks\n\nMY DEFAULT RULE:\nIf the task involves a document longer than 5 pages — Claude.\nIf the task involves the internet or images — ChatGPT.\nEverything else — flip a coin, they are genuinely equivalent.", formatting: {type:"paragraph"} },
    ];

    await supabase.from("content_blocks").insert(allBlocks);

    // ═══ MICROTAGS ═══
    const microtagAssignments: Record<string, string[]> = {
      c1: ["#one-prompt","#no-coding","#under-5-mins","#free-tools-only","#beginner-first"],
      c2: ["#zapier-ready","#template-included","#recurring-use","#for-teams","#requires-api-key"],
      c3: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c4: ["#no-coding","#free-tools-only","#beginner-first","#one-prompt","#under-5-mins"],
      c5: ["#zapier-ready","#no-coding","#under-5-mins","#free-tools-only","#beginner-first"],
      c6: ["#no-coding","#free-tools-only","#template-included","#recurring-use","#beginner-first"],
      c7: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c8: ["#no-coding","#free-tools-only","#beginner-first","#one-prompt","#under-5-mins"],
      c9: ["#make-ready","#zapier-ready","#template-included","#for-teams","#recurring-use"],
      c10: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c11: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c12: ["#no-coding","#free-tools-only","#beginner-first","#one-prompt","#template-included"],
      c13: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c14: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c15: ["#zapier-ready","#recurring-use","#requires-api-key","#for-teams","#template-included"],
      c16: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c17: ["#one-prompt","#no-coding","#free-tools-only","#beginner-first","#under-5-mins"],
      c18: ["#no-coding","#free-tools-only","#beginner-first","#one-prompt","#under-5-mins"],
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
