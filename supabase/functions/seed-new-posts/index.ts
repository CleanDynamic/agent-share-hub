import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POSTS = [
  // ── BUILDS (6) ──
  { title: "Auto-RAG Agent for Legal Documents", content_type: "Agent Blueprint", difficulty: "Advanced", ai_tools: ["GPT-4", "LangChain"], topics: ["RAG", "Autonomous Agents"], desc: "A fully autonomous retrieval-augmented agent that ingests legal PDFs, chunks them semantically, and answers complex multi-hop questions with citations." },
  { title: "Slack-to-Notion Workflow Automator", content_type: "Workflow Template", difficulty: "Intermediate", ai_tools: ["Claude", "Zapier"], topics: ["AI Workflows", "Tool Use"], desc: "Connects Slack threads to Notion databases automatically, summarising conversations and creating action items using Claude." },
  { title: "Multi-Model Debate Stack", content_type: "Agent Stack", difficulty: "Advanced", ai_tools: ["GPT-4", "Claude", "Gemini"], topics: ["Multi-Agent Systems", "LLM Evaluation"], desc: "Pit three LLMs against each other in structured debates. Includes judge agent, scoring rubric, and exportable transcripts." },
  { title: "Local LLaMA Fine-Tune Config", content_type: "Model Config Guide", difficulty: "Intermediate", ai_tools: ["LLaMA", "Ollama"], topics: ["Fine-Tuning", "Open Source Models"], desc: "Step-by-step model configuration for fine-tuning LLaMA 3 on custom datasets using QLoRA with 24GB VRAM." },
  { title: "Stripe + GPT Payment Intent Agent", content_type: "Integration Guide", difficulty: "Intermediate", ai_tools: ["GPT-4"], topics: ["Tool Use", "Code Generation"], desc: "An integration guide for building an AI agent that creates Stripe payment intents from natural language requests." },
  { title: "Voice-to-Task Agent Pipeline", content_type: "Agent Blueprint", difficulty: "Advanced", ai_tools: ["Whisper", "GPT-4"], topics: ["Voice & Audio", "Autonomous Agents"], desc: "Captures voice memos, transcribes with Whisper, extracts tasks with GPT-4, and pushes them to Todoist automatically." },

  // ── TECHNIQUES (6) ──
  { title: "Chain-of-Density Summarisation Prompt", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["GPT-4", "Claude"], topics: ["Prompt Engineering"], desc: "A proven prompt technique that produces increasingly dense summaries by iteratively fusing entities into shorter text." },
  { title: "Few-Shot Classification with Structured Output", content_type: "Prompt File", difficulty: "Intermediate", ai_tools: ["GPT-4"], topics: ["Prompt Engineering", "Code Generation"], desc: "Template for building few-shot classifiers that return structured JSON, with guardrails for hallucination prevention." },
  { title: "Adversarial Red-Team Evaluation Framework", content_type: "Evaluation Framework", difficulty: "Advanced", ai_tools: ["GPT-4", "Claude"], topics: ["LLM Evaluation", "AI Safety"], desc: "A systematic framework for red-teaming language models using adversarial prompts, jailbreak detection, and safety scoring." },
  { title: "Temperature Ladder Search for Creative Writing", content_type: "Prompt File", difficulty: "Beginner", ai_tools: ["Claude"], topics: ["Prompt Engineering"], desc: "A technique that runs the same creative prompt at 5 temperature levels and lets you pick the best output quality." },
  { title: "Retrieval Quality Scoring Rubric", content_type: "Evaluation Framework", difficulty: "Intermediate", ai_tools: ["GPT-4"], topics: ["RAG", "LLM Evaluation"], desc: "Score your RAG pipeline retrieval quality across relevance, coverage, and freshness dimensions with this evaluation rubric." },
  { title: "System Prompt Layering for Complex Agents", content_type: "Prompt File", difficulty: "Intermediate", ai_tools: ["Claude", "GPT-4"], topics: ["Prompt Engineering", "Autonomous Agents"], desc: "A technique for composing system prompts in layers — persona, constraints, tools, output format — for more controllable agents." },

  // ── DISCOVERIES (6) ──
  { title: "GPT-4 Silently Drops Long Tool Outputs", content_type: "Failure Library", difficulty: "Any", ai_tools: ["GPT-4"], topics: ["Tool Use", "LLM Evaluation"], desc: "Documented a failure where GPT-4 silently truncates tool call responses over 4000 tokens without any warning or error." },
  { title: "Claude Outperforms GPT-4 on Nested JSON", content_type: "Failure Library", difficulty: "Intermediate", ai_tools: ["Claude", "GPT-4"], topics: ["Code Generation", "LLM Evaluation"], desc: "Benchmark showing Claude 3.5 Sonnet produces valid nested JSON 94% of the time vs GPT-4's 78% on complex schemas." },
  { title: "Embedding Drift After Model Updates", content_type: "Failure Library", difficulty: "Advanced", ai_tools: ["OpenAI"], topics: ["Embeddings", "Vector Databases"], desc: "Discovery: OpenAI embedding model updates cause cosine similarity drift of 8-15%, breaking existing vector search indexes." },
  { title: "Gemini Flash Beats Pro on Simple Extraction", content_type: "Failure Library", difficulty: "Beginner", ai_tools: ["Gemini"], topics: ["LLM Evaluation", "Commercial Models"], desc: "Found that Gemini Flash outperforms Gemini Pro on simple entity extraction tasks while being 10x cheaper." },
  { title: "Unexpected RAG Chunk Overlap Benefits", content_type: "Failure Library", difficulty: "Intermediate", ai_tools: ["GPT-4", "Pinecone"], topics: ["RAG", "Vector Databases"], desc: "Discovered that 25% chunk overlap improves retrieval accuracy by 18% compared to non-overlapping chunks in legal docs." },
  { title: "Whisper Hallucinations on Silent Audio", content_type: "Failure Library", difficulty: "Any", ai_tools: ["Whisper"], topics: ["Voice & Audio", "AI Safety"], desc: "Whisper generates confident but completely fabricated transcriptions when given silent or near-silent audio segments." },

  // ── DISCUSSIONS (7) ──
  { title: "Is Fine-Tuning Dead for Most Use Cases?", content_type: "Blog", difficulty: "Any", ai_tools: ["GPT-4", "Claude"], topics: ["Fine-Tuning", "Prompt Engineering"], desc: "With prompts getting better and context windows growing, is fine-tuning still worth the effort for most teams? Let's discuss." },
  { title: "The Ethics of AI-Generated Code in Production", content_type: "Blog", difficulty: "Any", ai_tools: ["Copilot", "Cursor"], topics: ["AI Ethics", "Code Generation"], desc: "Should AI-generated code carry different liability? A discussion on accountability when Copilot writes your auth logic." },
  { title: "What's Your Agent Monitoring Stack?", content_type: "Open Question", difficulty: "Any", ai_tools: ["LangSmith", "Helicone"], topics: ["Autonomous Agents", "AI Workflows"], desc: "Looking for recommendations on monitoring autonomous agents in production. What tools and patterns are you using?" },
  { title: "Challenge: Build a RAG Pipeline Under $5/month", content_type: "Challenge", difficulty: "Intermediate", ai_tools: ["Ollama", "Qdrant"], topics: ["RAG", "Open Source Models"], desc: "Can you build a production-quality RAG pipeline that costs under $5/month to run? Share your architecture." },
  { title: "Open Source vs Commercial Models in 2025", content_type: "Blog", difficulty: "Any", ai_tools: ["LLaMA", "GPT-4", "Mistral"], topics: ["Open Source Models", "Commercial Models"], desc: "The gap between open source and commercial models is closing fast. Here's where each still wins." },
  { title: "How Do You Handle LLM Rate Limits Gracefully?", content_type: "Open Question", difficulty: "Intermediate", ai_tools: ["GPT-4", "Claude"], topics: ["AI Workflows", "Tool Use"], desc: "Rate limits are the bane of production AI apps. What retry strategies, queuing systems, or fallback patterns do you use?" },
  { title: "Challenge: Smallest Useful Agent", content_type: "Challenge", difficulty: "Beginner", ai_tools: ["GPT-4"], topics: ["Autonomous Agents", "Prompt Engineering"], desc: "What's the smallest, most useful agent you can build with a single system prompt and one tool? Share yours." },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check idempotency
    const { data: existing } = await supabase
      .from("content_items")
      .select("id")
      .eq("title", POSTS[0].title)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ message: "Seed posts already exist, skipping." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find a creator
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .limit(10);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No profiles found to assign as creator." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const rows = POSTS.map((p, i) => ({
      title: p.title,
      content_type: p.content_type,
      difficulty: p.difficulty,
      ai_tools: p.ai_tools,
      topics: p.topics,
      description: p.desc,
      status: "approved",
      approved_at: now,
      creator_id: profiles[i % profiles.length].id,
      monetisation_type: "free",
      tags: [],
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("content_items")
      .insert(rows)
      .select("id");

    if (insertErr) throw insertErr;

    // Add a text block to each post
    const blocks = (inserted ?? []).map((item: { id: string }, i: number) => ({
      content_id: item.id,
      block_type: "text",
      position: 0,
      text_content: POSTS[i].desc + "\n\nThis is a seed post for testing the new post type system.",
      formatting_type: "paragraph",
      is_preview: true,
    }));

    if (blocks.length > 0) {
      const { error: blockErr } = await supabase
        .from("content_blocks")
        .insert(blocks);
      if (blockErr) console.error("Block insert error:", blockErr);
    }

    return new Response(
      JSON.stringify({ message: `Seeded ${inserted?.length ?? 0} posts.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
