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

    // ═══ STEP 5 — VIEWS (content_views + view_count) ═══
    const viewData: Record<string, string[]> = {
      c1: ["power","sam","lurker","newjoin","devtest","priya","marcus","sofia"],
      c2: ["power","devtest","jamie","sam","alex"],
      c3: ["power","sam","devtest","sofia","isabelle","chen"],
      c4: ["power","sam","lurker","newjoin","devtest","marcus","jamie","isabelle","chen"],
      c5: ["power","sam","newjoin","devtest","isabelle","priya"],
      c6: ["power","devtest","alex","marcus","priya"],
      c7: ["power","sam","lurker","newjoin","devtest","alex","marcus","priya","sofia","chen"],
      c8: ["power","sam","lurker","newjoin","devtest","priya","sofia","jamie","chen"],
      c9: ["power","devtest","alex","sofia"],
      c10: ["power","sam","devtest","sofia","isabelle","priya","chen"],
      c11: ["power","sam","lurker","newjoin","devtest","alex","marcus","jamie","chen"],
      c12: ["power","devtest","alex","marcus","sofia","priya"],
      c13: ["power","sam","newjoin","devtest","sofia","isabelle"],
      c14: ["power","sam","lurker","newjoin","devtest","marcus","sofia","chen"],
      c15: ["power","devtest","alex","priya","sofia"],
      c16: ["power","sam","lurker","newjoin","devtest","priya","marcus","jamie"],
      c17: ["power","sam","lurker","devtest","alex","sofia","chen"],
      c18: ["power","devtest","sam","marcus","priya","sofia","jamie"],
    };

    const viewInserts: any[] = [];
    for (const [cKey, viewers] of Object.entries(viewData)) {
      for (const u of viewers) {
        viewInserts.push({ user_id: users[u], content_id: contentMap[cKey], viewed_at: daysAgo(Math.floor(Math.random() * 25) + 1) });
      }
    }
    await supabase.from("content_views").insert(viewInserts);

    // ═══ STEP 6 — DOWNLOADS (downloads + download_count + user_interactions) ═══
    const dlData: Record<string, string[]> = {
      c1: ["power","sam","newjoin","devtest","priya"],
      c2: ["power","devtest"],
      c3: ["power","sam","devtest","sofia"],
      c4: ["power","sam","newjoin","devtest","marcus","isabelle"],
      c5: ["power","sam","devtest","isabelle"],
      c6: ["power","devtest","alex"],
      c7: ["power","sam","newjoin","devtest","alex","priya"],
      c8: ["power","sam","newjoin","lurker","devtest","priya","jamie"],
      c9: ["power"],
      c10: ["power","sam","devtest","isabelle","priya"],
      c11: ["power","sam","newjoin","devtest","alex","jamie"],
      c12: ["power","devtest","alex","marcus"],
      c13: ["power","sam","devtest","sofia"],
      c14: ["power","sam","lurker","newjoin","devtest","marcus","chen"],
      c15: ["power","devtest"],
      c16: ["power","sam","lurker","newjoin","devtest","priya","jamie"],
      c17: ["power","sam","devtest","alex"],
      c18: ["power","devtest","sam","sofia","jamie"],
    };

    const dlInserts: any[] = [];
    const dlInteractions: any[] = [];
    const contentTitles: Record<string, string> = {};
    for (const cd of contentDefs) { contentTitles[cd.key] = cd.title; }

    for (const [cKey, downloaders] of Object.entries(dlData)) {
      for (const u of downloaders) {
        const ts = daysAgo(Math.floor(Math.random() * 20) + 1);
        dlInserts.push({ user_id: users[u], content_id: contentMap[cKey], downloaded_at: ts });
        dlInteractions.push({ user_id: users[u], content_id: contentMap[cKey], interaction_type: "downloaded", interaction_meta: { content_title: contentTitles[cKey] }, created_at: ts });
      }
    }
    await supabase.from("downloads").insert(dlInserts);
    await supabase.from("user_interactions").insert(dlInteractions);

    // ═══ STEP 7 — RATINGS (content_ratings + user_interactions) ═══
    const ratingData: [string, string, number][] = [
      ["power","c1",5],["sam","c1",4],["devtest","c1",5],["priya","c1",4],
      ["power","c2",4],["devtest","c2",5],
      ["power","c3",5],["sam","c3",4],["devtest","c3",4],["sofia","c3",5],
      ["power","c4",5],["sam","c4",5],["newjoin","c4",4],["devtest","c4",5],["marcus","c4",4],["isabelle","c4",5],
      ["power","c5",4],["sam","c5",5],["devtest","c5",4],["isabelle","c5",5],
      ["power","c6",4],["devtest","c6",5],["alex","c6",5],
      ["power","c7",5],["sam","c7",5],["newjoin","c7",4],["devtest","c7",5],["alex","c7",4],["priya","c7",5],
      ["power","c8",5],["sam","c8",5],["newjoin","c8",5],["lurker","c8",4],["devtest","c8",5],["priya","c8",4],["jamie","c8",5],
      ["power","c9",5],
      ["power","c10",4],["sam","c10",4],["devtest","c10",5],["isabelle","c10",5],["priya","c10",4],
      ["power","c11",5],["sam","c11",5],["newjoin","c11",4],["devtest","c11",5],["alex","c11",5],["jamie","c11",4],
      ["power","c12",4],["devtest","c12",5],["alex","c12",5],["marcus","c12",4],
      ["power","c13",4],["sam","c13",5],["devtest","c13",4],["sofia","c13",5],
      ["power","c14",5],["sam","c14",5],["lurker","c14",5],["newjoin","c14",4],["devtest","c14",5],["marcus","c14",4],["chen","c14",5],
      ["power","c15",4],["devtest","c15",5],
      ["power","c16",5],["sam","c16",5],["lurker","c16",4],["newjoin","c16",5],["devtest","c16",5],["priya","c16",4],["jamie","c16",5],
      ["power","c17",5],["sam","c17",5],["devtest","c17",5],["alex","c17",5],
      ["power","c18",4],["devtest","c18",5],["sam","c18",4],["sofia","c18",5],["jamie","c18",4],
    ];

    const ratingInserts: any[] = [];
    const ratingInteractions: any[] = [];
    for (const [u, c, r] of ratingData) {
      const ts = daysAgo(Math.floor(Math.random() * 20) + 1);
      ratingInserts.push({ user_id: users[u], content_id: contentMap[c], rating: r, created_at: ts, updated_at: ts });
      ratingInteractions.push({ user_id: users[u], content_id: contentMap[c], interaction_type: "rated", interaction_meta: { rating: r, content_title: contentTitles[c] }, created_at: ts });
    }
    await supabase.from("content_ratings").insert(ratingInserts);
    await supabase.from("user_interactions").insert(ratingInteractions);

    // ═══ STEP 8 — COMMENTS (content_comments + user_interactions) ═══
    const commentData: { u: string; c: string; text: string; daysAgo: number }[] = [
      // Post 1
      { u:"sam", c:"c1", text:"Been using this every day for two weeks. The one thing I changed is adding 'keep it under 100 words' at the end. Game changer.", daysAgo:20 },
      { u:"power", c:"c1", text:"Works perfectly in Claude too, not just ChatGPT. The prompt is clean enough to transfer across models without any changes.", daysAgo:18 },
      { u:"priya", c:"c1", text:"Great starting point. I added a line asking it to flag if any information seems missing and now it prompts me when my draft is vague.", daysAgo:12 },
      // Post 3
      { u:"sofia", c:"c3", text:"Used this for client research yesterday. The part where it flags contested claims is genuinely useful — saved me from publishing something inaccurate.", daysAgo:10 },
      { u:"devtest", c:"c3", text:"Testing comment functionality. The prompt works as described.", daysAgo:8 },
      // Post 4
      { u:"sam", c:"c4", text:"This is literally the only AI tutorial that made sense to me. I have read about ten others and they all assume I know things I do not know.", daysAgo:15 },
      { u:"isabelle", c:"c4", text:"Sending this to every small business owner I know. The before/after comparison at the end is worth the whole article.", daysAgo:14 },
      { u:"newjoin", c:"c4", text:"Just tried the four elements method on my first ever prompt. The output was completely different. Thank you.", daysAgo:6 },
      { u:"power", c:"c4", text:"Solid fundamentals. For anyone who has been using AI for a while this is revision not revelation but the examples are the best I have seen.", daysAgo:5 },
      // Post 7
      { u:"alex", c:"c7", text:"This exact failure happened to me too. The word 'empathetic' is a trap in any customer service prompt — I should write a follow-up post about the other words to avoid.", daysAgo:4 },
      { u:"power", c:"c7", text:"Five star post. Short, specific, immediately actionable. This is what the Failure Library should be.", daysAgo:3 },
      { u:"sam", c:"c7", text:"I run a small online shop and this is exactly the problem I had. Did not know how to explain it until now.", daysAgo:2 },
      // Post 8
      { u:"newjoin", c:"c8", text:"This is genuinely the clearest explanation of the difference I have found. Bookmarking this permanently.", daysAgo:7 },
      { u:"lurker", c:"c8", text:"Good.", daysAgo:5 },
      { u:"priya", c:"c8", text:"The Google Workspace point for Gemini is underrated. For anyone living in Google Docs and Gmail, Gemini is the obvious choice and nobody talks about it.", daysAgo:4 },
      // Post 11
      { u:"alex", c:"c11", text:"The fix you found — writing the first paragraph yourself and handing the rest to AI — is exactly right. Voice is the one thing AI cannot reproduce from a description. You have to show it.", daysAgo:2 },
      { u:"marcus", c:"c11", text:"I ran into the same problem. The continuation issue (AI building on its own outputs rather than yours) is genuinely underreported. Good catch.", daysAgo:1 },
      // Post 14
      { u:"sam", c:"c14", text:"The three role prompts at the end are worth this entire post. Copied them immediately.", daysAgo:12 },
      { u:"chen", c:"c14", text:"Tested all three role examples across ChatGPT, Claude, and Gemini. Performance improvement was consistent across all three. This technique is model-agnostic which is exactly what it needs to be for this platform.", daysAgo:10 },
      { u:"power", c:"c14", text:"Isabelle consistently writes the most accessible content on here. This is the kind of thing that actually converts someone from occasional AI user to daily AI user.", daysAgo:8 },
      { u:"marcus", c:"c14", text:"I would add one more: for brainstorming try 'You are a creative director with 15 years experience and no filter — share every idea including the ones that seem ridiculous.' The uninhibited role unlocks ideas the assistant-framing suppresses.", daysAgo:3 },
      // Post 17
      { u:"sofia", c:"c17", text:"I needed to read this today. I have been slowly handing more of my newsletter to AI and I noticed my open rate dropping. This explains exactly why.", daysAgo:0.83 },
      { u:"devtest", c:"c17", text:"Testing comment on new post.", daysAgo:0.75 },
    ];

    const commentInserts = commentData.map((cd) => ({
      user_id: users[cd.u], content_id: contentMap[cd.c], text: cd.text, created_at: daysAgo(cd.daysAgo),
    }));
    const { data: insertedComments } = await supabase.from("content_comments").insert(commentInserts).select("id, user_id, content_id, text");

    // user_interactions for comments
    const commentInteractions = commentData.map((cd) => ({
      user_id: users[cd.u], content_id: contentMap[cd.c], interaction_type: "commented", interaction_meta: { content_title: contentTitles[cd.c] }, created_at: daysAgo(cd.daysAgo),
    }));
    await supabase.from("user_interactions").insert(commentInteractions);

    // ═══ STEP 9 — COMMENT LIKES (comment_likes + like_count) ═══
    // Build a lookup: find comment by user+content combo
    const commentLookup: Record<string, string> = {};
    if (insertedComments) {
      for (const ic of insertedComments) {
        // Map by matching user_id and content_id and text prefix
        const matchIdx = commentData.findIndex((cd) =>
          users[cd.u] === ic.user_id && contentMap[cd.c] === ic.content_id && ic.text === cd.text
        );
        if (matchIdx >= 0) {
          commentLookup[`${commentData[matchIdx].u}_${commentData[matchIdx].c}`] = ic.id;
        }
      }
    }

    const commentLikesDef: { commentKey: string; likers: string[] }[] = [
      { commentKey: "sam_c1", likers: ["power","devtest","priya"] },
      { commentKey: "power_c1", likers: ["sam","devtest"] },
      { commentKey: "sofia_c3", likers: ["power","devtest","marcus"] },
      { commentKey: "sam_c4", likers: ["power","newjoin","isabelle","marcus","sofia","devtest"] },
      { commentKey: "isabelle_c4", likers: ["sam","power","newjoin","devtest","marcus"] },
      { commentKey: "power_c7", likers: ["sam","alex","devtest","priya","sofia"] },
      { commentKey: "alex_c7", likers: ["power","sam","priya","marcus","devtest"] },
      { commentKey: "priya_c8", likers: ["power","sam","newjoin","devtest","jamie"] },
      { commentKey: "newjoin_c8", likers: ["power","sam","devtest"] },
      { commentKey: "alex_c11", likers: ["power","sam","marcus","devtest","priya","sofia"] },
      { commentKey: "sam_c14", likers: ["power","newjoin","devtest","isabelle","sofia"] },
      { commentKey: "chen_c14", likers: ["power","devtest","alex","marcus","priya"] },
      { commentKey: "power_c14", likers: ["sam","newjoin","devtest","marcus"] },
      { commentKey: "marcus_c14", likers: ["power","devtest","alex","chen","sofia"] },
      { commentKey: "sofia_c17", likers: ["power","sam","devtest","alex","marcus"] },
    ];

    const clInserts: any[] = [];
    const clCounts: Record<string, number> = {};
    for (const def of commentLikesDef) {
      const commentId = commentLookup[def.commentKey];
      if (!commentId) continue;
      clCounts[commentId] = def.likers.length;
      for (const liker of def.likers) {
        clInserts.push({ comment_id: commentId, user_id: users[liker] });
      }
    }
    if (clInserts.length > 0) {
      await supabase.from("comment_likes").insert(clInserts);
      // Update like_count on comments
      await Promise.all(
        Object.entries(clCounts).map(([cid, count]) =>
          supabase.from("content_comments").update({ like_count: count }).eq("id", cid)
        )
      );
    }

    // ═══ STEP 10 — TIPS (content_tips + tip_upvotes) ═══
    const tipsDef: { u: string; c: string; tool: string | null; text: string; upvoters: string[] }[] = [
      { u:"devtest", c:"c1", tool:"Claude", text:"In Claude, if you add 'Preserve any specific facts or numbers from the original' it stops the rewrite from accidentally dropping key information like prices or dates.", upvoters:["power","sam","priya","marcus"] },
      { u:"power", c:"c4", tool:null, text:"The Format element is the most underrated of the four. Specifying 'three bullet points' vs 'a numbered list' vs 'a paragraph' produces completely different outputs even with the same content instruction.", upvoters:["sam","newjoin","devtest","isabelle","marcus","sofia"] },
      { u:"alex", c:"c7", tool:"ChatGPT", text:"In ChatGPT I also added: 'Before responding, classify the message as: question / complaint / compliment / other. Then respond appropriately for that type.' This completely eliminated the wrong-tone responses.", upvoters:["power","sam","priya","devtest","isabelle","marcus"] },
      { u:"chen", c:"c8", tool:null, text:"One more practical difference: Claude is significantly better at maintaining a persona or character consistently across a long conversation. ChatGPT drifts more. If you are building a custom assistant that needs to stay in character — use Claude.", upvoters:["power","devtest","alex","marcus","priya","sofia","jamie"] },
      { u:"marcus", c:"c14", tool:null, text:"Stacking roles makes this even more powerful: 'You are a copywriter who specialises in local food businesses AND who writes in a casual weekend-newspaper style.' Specificity compounds.", upvoters:["power","sam","devtest","isabelle","sofia","newjoin"] },
    ];

    for (const tip of tipsDef) {
      const { data: insertedTip } = await supabase.from("content_tips").insert({
        user_id: users[tip.u], content_id: contentMap[tip.c], text: tip.text,
        ai_tool_context: tip.tool, upvote_count: tip.upvoters.length,
      }).select("id").single();

      if (insertedTip) {
        await supabase.from("tip_upvotes").insert(
          tip.upvoters.map((v) => ({ tip_id: insertedTip.id, user_id: users[v] }))
        );
      }
    }

    // ═══ STEP 11 — VERIFICATIONS (content_verifications) ═══
    const verificationData: [string, string, string][] = [
      // Post 4 — 6 verifications → is_verified = true
      ["power","c4","ChatGPT"],["sam","c4","ChatGPT"],["devtest","c4","Claude"],["isabelle","c4","ChatGPT"],["marcus","c4","Gemini"],["sofia","c4","ChatGPT"],
      // Post 8 — 6 verifications → is_verified = true
      ["power","c8","ChatGPT"],["sam","c8","ChatGPT"],["lurker","c8","ChatGPT"],["newjoin","c8","ChatGPT"],["devtest","c8","Claude"],["priya","c8","Zapier"],
      // Post 14 — 7 verifications → is_verified = true
      ["power","c14","ChatGPT"],["sam","c14","ChatGPT"],["devtest","c14","Claude"],["lurker","c14","ChatGPT"],["marcus","c14","Gemini"],["chen","c14","Claude"],["newjoin","c14","ChatGPT"],
      // Post 1 — 4 verifications → is_verified = false
      ["power","c1","ChatGPT"],["sam","c1","ChatGPT"],["priya","c1","ChatGPT"],["devtest","c1","Claude"],
      // Post 7 — 5 verifications → is_verified = true
      ["power","c7","ChatGPT"],["sam","c7","ChatGPT"],["alex","c7","Claude"],["priya","c7","ChatGPT"],["devtest","c7","Claude"],
    ];

    await supabase.from("content_verifications").insert(
      verificationData.map(([u, c, tool]) => ({
        user_id: users[u], content_id: contentMap[c], ai_tool_used: tool,
      }))
    );

    // ═══ STEP 12 — LIBRARY SAVES (user_library) ═══
    const libraryData: Record<string, string[]> = {
      power: ["c1","c2","c3","c4","c5","c6","c7","c8","c9","c10","c11","c12","c13","c14","c15","c16","c17","c18"],
      sam: ["c1","c4","c5","c7","c8","c10","c13","c14","c16","c17"],
      devtest: ["c1","c3","c4","c7","c8","c14","c16"],
      lurker: ["c8","c14","c16"],
      newjoin: ["c4","c8","c14"],
      priya: ["c1","c6","c12","c15"],
      marcus: ["c4","c6","c12","c18"],
      sofia: ["c4","c7","c11","c13","c14"],
      chen: ["c4","c6","c12","c18"],
      jamie: ["c2","c5","c8","c16","c18"],
      alex: ["c6","c7","c11","c12","c17"],
      isabelle: ["c4","c6","c10","c14"],
    };

    const libInserts: any[] = [];
    for (const [u, cKeys] of Object.entries(libraryData)) {
      for (const c of cKeys) {
        const ver = contentDefs.find((cd) => cd.key === c)?.current_version || "1.0";
        libInserts.push({ user_id: users[u], content_id: contentMap[c], last_seen_version: ver, has_update: false });
      }
    }
    await supabase.from("user_library").insert(libInserts);

    // ═══ STEP 13 — BOOKMARKS (user_saves) ═══
    const bookmarkData: [string, string][] = [
      ["sam","c7"],["sam","c14"],
      ["power","c4"],["power","c7"],["power","c17"],
      ["newjoin","c4"],["newjoin","c8"],
      ["devtest","c1"],["devtest","c4"],
    ];
    await supabase.from("user_saves").insert(
      bookmarkData.map(([u, c]) => ({ user_id: users[u], content_id: contentMap[c] }))
    );

    // user_interactions for bookmarks
    await supabase.from("user_interactions").insert(
      bookmarkData.map(([u, c]) => ({
        user_id: users[u], content_id: contentMap[c], interaction_type: "bookmark",
        interaction_meta: { content_title: contentTitles[c] },
      }))
    );

    // ═══ STEP 14 — CURATOR RECOMMENDATIONS ═══
    const { data: alexCurator } = await supabase.from("curators").select("id").eq("user_id", users.alex).single();
    const { data: chenCurator } = await supabase.from("curators").select("id").eq("user_id", users.chen).single();

    if (alexCurator && chenCurator) {
      await supabase.from("curator_recommendations").insert([
        { curator_id: alexCurator.id, content_id: contentMap.c4, recommendation_text: "The clearest beginner prompt tutorial I have read. Sofia explains the four-element method better than any paid course I have seen. This should be the first thing anyone reads on this platform.", is_active: true },
        { curator_id: alexCurator.id, content_id: contentMap.c14, recommendation_text: "Isabelle writes for the people who actually need this platform. If you run a business and think AI is not for you, read this post first. The role prompting technique alone is worth the 5 minutes.", is_active: true },
        { curator_id: chenCurator.id, content_id: contentMap.c7, recommendation_text: "The best Failure Library post currently on NeoScale AI. Specific failure, specific fix, immediately applicable to anyone building customer-facing AI. This is the standard all Failure posts should aim for.", is_active: true },
        { curator_id: chenCurator.id, content_id: contentMap.c18, recommendation_text: "Marcus runs the comparison I have been meaning to write for months. The decision framework in the final section is exactly right. Bookmarked this permanently.", is_active: true },
      ]);

      // Trigger sets has_curator_recommendation but let's ensure it
      await Promise.all(
        [contentMap.c4, contentMap.c14, contentMap.c7, contentMap.c18].map((id) =>
          supabase.from("content_items").update({ has_curator_recommendation: true }).eq("id", id)
        )
      );
    }

    // ═══ STEP 15 — COLLECTIONS ═══
    const collectionDefs = [
      { owner: "power", title: "The Complete Beginner Starter Pack", description: "Everything I wish I had when I first started using AI. All free, all tested.", visibility: "public", slug: "beginner-starter-pack-power", items: ["c8","c4","c14","c1","c16","c10"] },
      { owner: "sofia", title: "My Content Creation Stack", description: "The posts I actually use for my newsletter and social media workflow.", visibility: "public", slug: "content-creation-stack-sofia", items: ["c4","c11","c13","c17"] },
      { owner: "devtest", title: "Test Collection", description: "Testing the collections feature.", visibility: "private", slug: "test-collection-devtest", items: ["c1","c4"] },
    ];

    const collectionIds: Record<string, string> = {};
    for (const col of collectionDefs) {
      const { data: inserted } = await supabase.from("collections").insert({
        owner_id: users[col.owner], title: col.title, description: col.description,
        visibility: col.visibility, is_public: col.visibility === "public",
        slug: col.slug, item_count: col.items.length,
      }).select("id").single();

      if (inserted) {
        collectionIds[col.title] = inserted.id;
        await supabase.from("collection_items").insert(
          col.items.map((cKey, idx) => ({
            collection_id: inserted.id, content_id: contentMap[cKey],
            added_by: users[col.owner], position: idx,
          }))
        );
      }
    }

    // Collection follows
    const colFollowsDef: [string, string][] = [
      ["sam","The Complete Beginner Starter Pack"],
      ["newjoin","The Complete Beginner Starter Pack"],
      ["lurker","The Complete Beginner Starter Pack"],
      ["power","My Content Creation Stack"],
      ["devtest","My Content Creation Stack"],
      ["marcus","My Content Creation Stack"],
    ];

    const colFollowInserts = colFollowsDef
      .filter(([, title]) => collectionIds[title])
      .map(([u, title]) => ({ follower_id: users[u], collection_id: collectionIds[title] }));
    if (colFollowInserts.length > 0) {
      await supabase.from("collection_follows").insert(colFollowInserts);
    }

    // Update follower_count on collections
    const colFollowCounts: Record<string, number> = {};
    for (const [, title] of colFollowsDef) {
      const cid = collectionIds[title];
      if (cid) colFollowCounts[cid] = (colFollowCounts[cid] || 0) + 1;
    }
    await Promise.all(
      Object.entries(colFollowCounts).map(([id, count]) =>
        supabase.from("collections").update({ follower_count: count }).eq("id", id)
      )
    );

    // ═══ STEP 16 — CHANGELOG ENTRIES ═══
    await supabase.from("content_changelogs").insert([
      { content_id: contentMap.c1, created_by: users.alex, version_label: "v1.2", change_note: "Added instruction to preserve specific numbers and dates after user tip in comments. Thanks @devtest.", created_at: daysAgo(15) },
      { content_id: contentMap.c4, created_by: users.sofia, version_label: "v1.1", change_note: "Added a third worked example in the Format section after feedback that one example was not enough.", created_at: daysAgo(10) },
      { content_id: contentMap.c12, created_by: users.chen, version_label: "v2.1", change_note: "Updated scoring dimensions after testing 200+ outputs. Added Completeness as a fifth dimension — it was the most common gap in earlier versions.", created_at: daysAgo(5) },
    ]);

    // ═══ STEP 17 — NOTIFICATIONS ═══
    const notifInserts = [
      // For alex
      { recipient_id: users.alex, notification_type: "new_follower", actor_id: users.sam, created_at: daysAgo(25), is_read: false },
      { recipient_id: users.alex, notification_type: "new_follower", actor_id: users.power, created_at: daysAgo(22), is_read: false },
      { recipient_id: users.alex, notification_type: "new_download", actor_id: users.power, content_id: contentMap.c1, created_at: daysAgo(20), is_read: false },
      { recipient_id: users.alex, notification_type: "new_download", actor_id: users.sam, content_id: contentMap.c1, created_at: daysAgo(19), is_read: false },
      { recipient_id: users.alex, notification_type: "new_rating", actor_id: users.power, content_id: contentMap.c1, metadata: { rating: 5 }, created_at: daysAgo(20), is_read: false },
      { recipient_id: users.alex, notification_type: "curator_approved", created_at: daysAgo(30), is_read: false },
      // For sofia
      { recipient_id: users.sofia, notification_type: "new_follower", actor_id: users.power, created_at: daysAgo(25), is_read: false },
      { recipient_id: users.sofia, notification_type: "new_comment", actor_id: users.sam, content_id: contentMap.c4, created_at: daysAgo(15), is_read: false },
      { recipient_id: users.sofia, notification_type: "new_comment", actor_id: users.isabelle, content_id: contentMap.c4, created_at: daysAgo(14), is_read: false },
      { recipient_id: users.sofia, notification_type: "new_rating", actor_id: users.power, content_id: contentMap.c4, metadata: { rating: 5 }, created_at: daysAgo(20), is_read: false },
      { recipient_id: users.sofia, notification_type: "content_approved", content_id: contentMap.c4, created_at: daysAgo(21), is_read: false },
      // For isabelle
      { recipient_id: users.isabelle, notification_type: "new_comment", actor_id: users.sam, content_id: contentMap.c14, created_at: daysAgo(12), is_read: false },
      { recipient_id: users.isabelle, notification_type: "new_comment", actor_id: users.chen, content_id: contentMap.c14, created_at: daysAgo(10), is_read: false },
      { recipient_id: users.isabelle, notification_type: "new_follower", actor_id: users.sam, created_at: daysAgo(20), is_read: false },
      { recipient_id: users.isabelle, notification_type: "new_follower", actor_id: users.power, created_at: daysAgo(22), is_read: false },
      { recipient_id: users.isabelle, notification_type: "new_follower", actor_id: users.newjoin, created_at: daysAgo(15), is_read: false },
      // For chen
      { recipient_id: users.chen, notification_type: "curator_approved", created_at: daysAgo(28), is_read: false },
      { recipient_id: users.chen, notification_type: "new_comment", actor_id: users.priya, content_id: contentMap.c8, created_at: daysAgo(4), is_read: false },
      { recipient_id: users.chen, notification_type: "new_follower", actor_id: users.power, created_at: daysAgo(22), is_read: false },
    ];
    await supabase.from("notifications").insert(notifInserts);

    // ═══ STEP 18 — FINAL RECALCULATION ═══
    // Recalculate all profile follower/following counts
    const allUserKeys = Object.keys(users);
    await Promise.all(allUserKeys.map(async (key) => {
      const uid = users[key];
      const { count: fwerCount } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid);
      const { count: fwingCount } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid);
      await supabase.from("profiles").update({ follower_count: fwerCount || 0, following_count: fwingCount || 0 }).eq("id", uid);
    }));

    // Recalculate all content item counts
    const allContentKeys = contentDefs.map((c) => c.key);
    await Promise.all(allContentKeys.map(async (key) => {
      const cid = contentMap[key];
      const { count: dlCount } = await supabase.from("downloads").select("*", { count: "exact", head: true }).eq("content_id", cid);
      const { count: vwCount } = await supabase.from("content_views").select("*", { count: "exact", head: true }).eq("content_id", cid);
      const { count: cmCount } = await supabase.from("content_comments").select("*", { count: "exact", head: true }).eq("content_id", cid).eq("is_deleted", false);
      const { count: rtCount } = await supabase.from("content_ratings").select("*", { count: "exact", head: true }).eq("content_id", cid);
      const { data: avgData } = await supabase.from("content_ratings").select("rating").eq("content_id", cid);
      const avg = avgData && avgData.length > 0 ? avgData.reduce((s: number, r: any) => s + r.rating, 0) / avgData.length : 0;
      const { count: vrCount } = await supabase.from("content_verifications").select("*", { count: "exact", head: true }).eq("content_id", cid);
      await supabase.from("content_items").update({
        download_count: dlCount || 0,
        view_count: vwCount || 0,
        comment_count: cmCount || 0,
        rating_count: rtCount || 0,
        avg_rating: Math.round(avg * 100) / 100,
        star_rating: Math.round(avg * 100) / 100,
        verification_count: vrCount || 0,
        is_verified: (vrCount || 0) >= 5,
      }).eq("id", cid);
    }));

    // ═══ STEP 18b — BOUNTY SEED DATA ═══
    // Convert isabelle's Failure Library posts to Bounties
    const bountyGapText = "A fix that works in ChatGPT 3.5 free tier, requires no plugins, and can be set up in under 10 minutes.";
    await supabase.from("content_items").update({
      bounty_enabled: true,
      bounty_status: "open",
      bounty_gap: bountyGapText,
    } as any).in("id", [contentMap.c7, contentMap.c17]);

    // Insert sample bounty_responses for c7 (the customer service bot post)
    const { data: bountyRespInserts } = await supabase.from("bounty_responses" as any).insert([
      {
        bounty_content_id: contentMap.c7,
        responder_id: users.alex,
        how_it_fixes: "This fixes the over-apologising by injecting a hard constraint at the system level before any user message. The model cannot override it because it is placed before the conversation context.",
        tested_on: ["ChatGPT", "Claude"],
        upvotes: 4,
        inline_title: "Stop the Apology Loop — System Prompt Fix",
        inline_blocks: [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: "Add this as your system prompt before any customer service conversation: [RULE: Never apologise. Acknowledge issues factually. Offer solutions immediately. Do not use the words sorry, apologise, or unfortunately under any circumstances.]" }],
      },
      {
        bounty_content_id: contentMap.c7,
        responder_id: users.marcus,
        how_it_fixes: "Restructures the prompt to give the AI a persona that is factually helpful rather than emotionally responsive. Tested across 40 customer queries.",
        tested_on: ["ChatGPT"],
        upvotes: 2,
      },
    ] as any).select("id");

    // Add sample verifications for response 1
    if (bountyRespInserts && bountyRespInserts.length > 0) {
      const resp1Id = (bountyRespInserts[0] as any).id;
      const resp2Id = bountyRespInserts.length > 1 ? (bountyRespInserts[1] as any).id : null;
      if (resp1Id) {
        await supabase.from("bounty_response_verifications" as any).insert([
          { response_id: resp1Id, user_id: users.power },
          { response_id: resp1Id, user_id: users.sam },
        ] as any);
        // The trigger should update verified_count, but let's also manually set it
        await supabase.from("bounty_responses" as any).update({ verified_count: 2 } as any).eq("id", resp1Id);
      }
      if (resp2Id) {
        await supabase.from("bounty_response_verifications" as any).insert([
          { response_id: resp2Id, user_id: users.lurker },
        ] as any);
        await supabase.from("bounty_responses" as any).update({ verified_count: 1 } as any).eq("id", resp2Id);
      }
    }

    // Add some me-too entries for both bounties
    await supabase.from("bounty_me_too" as any).insert([
      { content_id: contentMap.c7, user_id: users.power },
      { content_id: contentMap.c7, user_id: users.sam },
      { content_id: contentMap.c7, user_id: users.newjoin },
      { content_id: contentMap.c17, user_id: users.lurker },
      { content_id: contentMap.c17, user_id: users.devtest },
    ] as any);

    // Update me_too counts
    await supabase.from("content_items" as any).update({ bounty_me_too_count: 3 } as any).eq("id", contentMap.c7);
    await supabase.from("content_items" as any).update({ bounty_me_too_count: 2 } as any).eq("id", contentMap.c17);

    // Recalculate collection counts
    for (const [, colId] of Object.entries(collectionIds)) {
      const { count: icCount } = await supabase.from("collection_items").select("*", { count: "exact", head: true }).eq("collection_id", colId);
      const { count: fcCount } = await supabase.from("collection_follows").select("*", { count: "exact", head: true }).eq("collection_id", colId);
      await supabase.from("collections").update({ item_count: icCount || 0, follower_count: fcCount || 0 }).eq("id", colId);
    }

    // Count totals for response
    const totalBlocks = allBlocks.length;
    const totalFollows = followPairs.length;
    const totalDownloads = dlInserts.length;
    const totalRatings = ratingData.length;
    const totalComments = commentData.length;
    const totalCommentLikes = clInserts.length;
    const totalTips = tipsDef.length;
    const totalVerifications = verificationData.length;
    const totalLibrary = libInserts.length;
    const totalNotifications = notifInserts.length;

    return new Response(
      JSON.stringify({
        users_created: 12,
        content_items: 18,
        content_blocks: totalBlocks,
        follows: totalFollows,
        downloads: totalDownloads,
        ratings: totalRatings,
        comments: totalComments,
        comment_likes: totalCommentLikes,
        tips: totalTips,
        verifications: totalVerifications,
        library_saves: totalLibrary,
        collections: 3,
        notifications: totalNotifications,
        status: "Seed complete",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
