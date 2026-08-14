import type { PostSpec } from "./content.ts";
import { COVERS } from "./content.ts";

/**
 * 30 seeded posts spanning every surface of the platform:
 * builds, techniques, discoveries, discussions, bounties and meta-bounties,
 * across free / paid / donation / pay-what-you-want / subscription monetisation.
 */
export const POSTS: PostSpec[] = [
  // ────────────────────────── BUILDS (9) ──────────────────────────
  {
    key: "contract-reader",
    title: "A contract reader that answers in the client's own words",
    post_type: "blueprint",
    content_type: "Agent Blueprint",
    difficulty: "Intermediate",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Research", "Business"],
    use_cases: ["Business", "Research"],
    custom_tags: ["documents", "legal", "search"],
    desc:
      "Drop a folder of contracts in, ask questions in plain English, get answers with the exact clause quoted underneath. Built to be honest when the answer is not in the documents.",
    author: 0,
    daysAgo: 2,
    monetisation: "paid",
    price: 12,
    cover: COVERS[0],
    metrics: { views: 4120, downloads: 318, rating: 4.7, ratings: 41 },
    stageGrid: {
      name: "Reading pipeline",
      blocks: [
        { type: "text", name: "Incoming documents" },
        { type: "prompt", name: "Clause extractor" },
        { type: "model", name: "Answer writer" },
        { type: "result", name: "Quoted answer" },
      ],
    },
    sections: [
      {
        h: "What this actually does",
        p: [
          "You give it a folder of agreements — supplier contracts, leases, employment terms, whatever you have — and then you ask questions the way you would ask a colleague. \"Which of these auto-renew?\" \"What notice period do we owe Halloran?\" It comes back with a short answer and, underneath it, the exact sentence from the exact document that the answer came from.",
          "The quoting is the whole point. An AI assistant will happily tell you a contract renews annually whether or not it says so. Forcing every answer to carry the sentence it rests on turns a confident guess into something you can check in four seconds. When it cannot find the sentence, it is instructed to say so rather than reason its way to a plausible answer.",
        ],
      },
      {
        h: "Setting it up, step by step",
        p: [
          "Start by converting everything to plain text. Scanned PDFs need a text layer first; if your files came out of a scanner, run them through any OCR tool before you begin, because otherwise you are asking the assistant to read a photograph of words. Name each file after the counterparty and the year, because those file names become the citations later.",
          "Next, split each document into overlapping chunks of roughly 800 words with 200 words of overlap. The overlap matters more than people expect: clauses regularly straddle a page break, and a clean split leaves half a definition on each side of the boundary. With overlap, at least one chunk contains the whole thought.",
        ],
        bullets: [
          "Convert to text, keep the original file name as a label.",
          "Chunk at ~800 words with ~200 words of overlap.",
          "Store the chunks with their file name and approximate page.",
          "At question time, retrieve the eight closest chunks, not three.",
        ],
      },
      {
        h: "The instruction that does the heavy lifting",
        p: [
          "Most of the quality comes from one carefully worded instruction, not from clever engineering. The version below has survived about four months of daily use with only small edits. The two clauses that matter most are the refusal clause and the quoting clause — remove either and the whole thing starts inventing.",
        ],
        code: {
          lang: "text",
          text: `You answer questions about the contracts provided below and nothing else.

Rules:
1. Every claim you make must be followed by the exact sentence it came from,
   in quotation marks, with the file name.
2. If the answer is not present in the provided text, reply exactly:
   "Not stated in the documents provided." Do not reason toward an answer.
3. If two documents disagree, show both quotes and say they disagree.
4. Keep the answer under 120 words before the quotes.

CONTRACTS:
{{retrieved_chunks}}

QUESTION:
{{question}}`,
        },
      },
      {
        h: "What twenty-five minutes of setup buys you",
        p: [
          "On a folder of forty supplier agreements, this answered eighteen of twenty test questions in a way I would forward to a colleague untouched. The two it missed were both cases where the answer depended on an appendix that had been sent as a separate email attachment and was never in the folder — which is a filing problem, not an AI problem, and it correctly said the answer was not present rather than guessing.",
          "The honest limitation: it is good at finding and quoting, and it is not a lawyer. It will tell you what the contract says. It will not tell you whether what the contract says is a bad idea.",
        ],
        quote:
          "The moment it started saying \"not stated in the documents provided\" instead of guessing, people in the team began to trust it.",
      },
    ],
    blocks: [
      {
        type: "text",
        text:
          "Works with any assistant that accepts long inputs. Tested on Claude and ChatGPT; both are fine. The differences show up only on documents with heavy cross-referencing, where Claude held the thread slightly better across appendices.",
        preview: true,
      },
      {
        type: "code",
        text:
          "chunk_size: 800\nchunk_overlap: 200\nretrieve_top_k: 8\nrefuse_when_no_match: true\nanswer_max_words: 120",
        instructions:
          "These are the settings I landed on. If your documents are short letters rather than long agreements, drop chunk_size to 400 and retrieve_top_k to 5.",
      },
      {
        type: "long_text",
        text:
          "Test questions I use on every new folder:\n\n1. Which agreements renew automatically?\n2. What is the longest notice period across all documents?\n3. Which counterparty has the strongest termination rights?\n4. Are there any exclusivity clauses?\n5. Which contracts mention price increases tied to an index?\n\nScore each answer as forwardable / needs editing / wrong. Anything under twelve forwardable out of twenty means the chunking is off before it means the instruction is off.",
      },
    ],
    results: [
      {
        kind: "written",
        text:
          "Ran it across 40 supplier agreements: 18/20 test questions answered cleanly, both misses correctly flagged as not-in-documents rather than guessed. Roughly four hours of manual reading replaced per month.",
        caption: "Six weeks of use, one small team",
      },
    ],
  },
  {
    key: "inbox-triage",
    title: "Inbox triage that sorts your morning before you open it",
    post_type: "blueprint",
    content_type: "Workflow Template",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Make"],
    topics: ["Productivity", "Email"],
    use_cases: ["Email", "Productivity"],
    custom_tags: ["email", "automation", "morning"],
    desc:
      "A ready-made setup that reads overnight email, sorts it into four buckets and writes you one short summary. No rules to maintain, no filters to fight.",
    author: 1,
    daysAgo: 5,
    monetisation: "free",
    cover: COVERS[1],
    metrics: { views: 9840, downloads: 1210, rating: 4.5, ratings: 132 },
    sections: [
      {
        h: "The problem with email rules",
        p: [
          "Traditional filters need you to predict the future. You write a rule for invoices, then someone sends an invoice with the subject line \"quick one\" and it lands in the wrong place forever. After a year you have forty rules, half of them wrong, and no idea which one is eating your mail.",
          "This setup does not use rules. It reads each message the way a competent assistant would and decides which of four buckets it belongs in: needs you today, needs you this week, someone else's problem, and noise. It is wrong sometimes. It is wrong far less often than a rule written eighteen months ago.",
        ],
      },
      {
        h: "Building it in Make",
        p: [
          "The whole flow is five steps. A scheduled trigger fires at 6am. It pulls unread mail from the last twelve hours. Each message goes to the assistant with the sorting instruction below. The result is written back as a label. Finally, one summary email lands in your inbox listing what is in the today bucket, with one line each.",
          "Keep the message body you send short — subject line, sender, and the first 400 words is plenty. Sending entire threads costs more and sorts no better, because the decision almost always lives in the first paragraph anyway.",
        ],
        bullets: [
          "Trigger: scheduled, 6am local, weekdays only.",
          "Fetch: unread, last 12 hours, exclude anything already labelled.",
          "Sort: one assistant call per message, 400-word cap.",
          "Apply: write the bucket back as a label.",
          "Summarise: one digest email, today bucket only.",
        ],
      },
      {
        h: "The sorting instruction",
        p: [
          "Note that it is told to prefer the lower-urgency bucket when unsure. That asymmetry is deliberate — an urgent thing sorted as weekly costs you a few hours of delay, while a newsletter sorted as urgent costs you your trust in the whole system within about three days.",
        ],
        code: {
          lang: "text",
          text: `Sort this email into exactly one bucket. Reply with the bucket name only.

TODAY   - needs a reply or decision from me before end of day
WEEK    - needs me, but not today
DELEGATE- belongs to someone else on my team
NOISE   - newsletters, receipts, notifications, no action needed

When unsure between two buckets, choose the less urgent one.

FROM: {{sender}}
SUBJECT: {{subject}}
BODY: {{first_400_words}}`,
        },
      },
      {
        h: "Two weeks of living with it",
        p: [
          "Over ten working days it sorted 611 messages. I disagreed with 34 of them, which is about one in eighteen. Almost all the disagreements were the same shape: a supplier sending a friendly note that actually contained a deadline buried in the last line. Adding \"deadlines mentioned anywhere in the message make it TODAY\" to the instruction cut that in half.",
          "The unexpected benefit was the digest. Reading nine one-line summaries at 8am and deciding the shape of the morning turned out to be worth more than the sorting itself.",
        ],
      },
    ],
    blocks: [
      {
        type: "text",
        text:
          "Works with Gmail or Outlook. In Make you want the 'Watch emails' module rather than 'Search emails' — search re-reads old mail and you will pay for the same message repeatedly.",
        preview: true,
      },
      {
        type: "code",
        text:
          "schedule: 0 6 * * 1-5\nlookback_hours: 12\nbody_chars: 2400\nbuckets: [TODAY, WEEK, DELEGATE, NOISE]\ntie_break: less_urgent",
      },
    ],
    results: [
      {
        kind: "written",
        text: "611 emails sorted over 10 working days. 34 disagreements (5.6%). Roughly 40 minutes a day of inbox scanning replaced by one 90-second digest read.",
        caption: "Two-week trial, single mailbox",
      },
    ],
  },
  {
    key: "meeting-to-actions",
    title: "Turning recorded meetings into actions people actually do",
    post_type: "blueprint",
    content_type: "Integration Guide",
    difficulty: "Intermediate",
    ai_tools: ["ChatGPT", "n8n"],
    topics: ["Productivity", "Business"],
    use_cases: ["Productivity", "Business"],
    custom_tags: ["meetings", "notes", "tasks"],
    desc:
      "Recording to task list, with owners and dates attached. The trick is refusing to invent an owner when nobody actually volunteered.",
    author: 1,
    daysAgo: 9,
    monetisation: "donation",
    cover: COVERS[2],
    metrics: { views: 5230, downloads: 402, rating: 4.4, ratings: 58 },
    sections: [
      {
        h: "Why most meeting summarisers are useless",
        p: [
          "They produce a tidy paragraph nobody reads. The value of a meeting is not the discussion, it is the four things somebody agreed to do, and those four things are usually phrased so vaguely in the room that they evaporate by Thursday.",
          "This setup extracts only commitments. If nobody committed to anything, it says the meeting produced no actions, which is uncomfortable and frequently accurate.",
        ],
      },
      {
        h: "The pipeline",
        p: [
          "Recording lands in a folder. Transcription runs. The transcript is chunked by speaker turn rather than by length, because commitments are almost always contained within a single person's turn and splitting mid-sentence destroys the ownership signal.",
          "Then one pass over the whole transcript pulls out candidate actions, and a second pass — this is the part most people skip — checks each candidate against the transcript to confirm somebody actually agreed to it rather than merely mentioned it. The second pass removes about a third of the candidates.",
        ],
        bullets: [
          "Chunk by speaker turn, not by word count.",
          "Pass one: extract candidate commitments.",
          "Pass two: verify each against the transcript, discard unverified.",
          "Only assign an owner when a name is explicitly attached.",
        ],
      },
      {
        h: "The verification prompt",
        p: [
          "This is the second pass. It is deliberately harsh. The output feeding your task manager should be shorter than you expect, because most of what happens in a meeting is not a commitment.",
        ],
        code: {
          lang: "text",
          text: `For each candidate action, decide: was this actually agreed?

Agreed means someone said they would do it, or accepted it when asked.
Discussed, suggested, or wondered aloud does not count.

Return only the agreed items as:
- action | owner (exact name said) | date (only if stated)

If no owner was named, write "unassigned". Never guess an owner.

TRANSCRIPT:
{{transcript}}

CANDIDATES:
{{candidates}}`,
        },
      },
      {
        h: "The unassigned problem",
        p: [
          "Roughly a quarter of verified actions come back unassigned, and the instinct is to fix that with cleverness — infer the owner from who talked most about it. Do not. An action assigned to the wrong person is worse than an action assigned to nobody, because the wrong person quietly ignores it and everyone assumes it is handled.",
          "Send the unassigned list to whoever chaired the meeting as a separate short message. It takes them ninety seconds and it is the highest-value part of the whole setup.",
        ],
      },
    ],
    blocks: [
      {
        type: "text",
        text: "Any transcription service works. If your recordings have long silences, trim them first — silence is where transcription models invent sentences that were never spoken.",
        preview: true,
      },
      {
        type: "code",
        text: "chunk_strategy: speaker_turn\nverification_pass: true\nassign_owner: only_if_named\nunassigned_route: chair",
      },
    ],
  },
  {
    key: "research-brief",
    title: "A research brief writer that shows its sources or shuts up",
    post_type: "blueprint",
    content_type: "Agent Stack",
    difficulty: "Advanced",
    ai_tools: ["Claude", "Gemini", "n8n"],
    topics: ["Research", "Content"],
    use_cases: ["Research", "Content"],
    custom_tags: ["research", "citations", "multi-step"],
    desc:
      "Three co-operating setups — a planner, a gatherer and a writer — that produce a two-page brief where every claim links to something you can open.",
    author: 0,
    daysAgo: 14,
    monetisation: "paid",
    price: 24,
    cover: COVERS[3],
    metrics: { views: 3310, downloads: 187, rating: 4.8, ratings: 33 },
    stageGrid: {
      name: "Brief assembly",
      blocks: [
        { type: "prompt", name: "Question planner" },
        { type: "tool", name: "Source gatherer" },
        { type: "prompt", name: "Claim checker" },
        { type: "result", name: "Two-page brief" },
      ],
    },
    sections: [
      {
        h: "Why three parts instead of one",
        p: [
          "A single instruction asking for a researched brief produces something that reads beautifully and contains four confident sentences that are not true. Splitting the job means each part has one small responsibility and can be checked independently, which is the only reliable way I have found to get output you can put your name on.",
          "The planner turns a vague request into six specific questions. The gatherer answers each question with material and keeps the links. The writer is given only the gathered material and is forbidden from adding anything else — it is explicitly told that its own knowledge is not admissible.",
        ],
      },
      {
        h: "The planner",
        p: [
          "Vague requests are the root of most bad research output. \"Tell me about the market for refurbished laptops\" produces a Wikipedia impression. The planner's job is to convert that into questions that have findable answers, and to reject its own questions that cannot be answered by a source.",
        ],
        code: {
          lang: "text",
          text: `Turn this request into exactly 6 research questions.

Each question must:
- be answerable by a specific document, report or dataset
- be narrow enough that one source could answer it
- avoid words like "trends", "landscape" or "overview"

Reject and rewrite any question you would not know how to look up.

REQUEST: {{request}}`,
        },
      },
      {
        h: "The writer, and its one hard rule",
        p: [
          "The writer sees only what the gatherer found. Its instruction contains the line that makes the whole stack worth running: any sentence that cannot be traced to gathered material must be deleted rather than softened. Softening is what produces \"industry observers suggest\" — a phrase which means the assistant made it up and hedged.",
          "In practice this produces briefs that are shorter and blunter than what people expect from AI-written research, with visible gaps where nothing was found. The gaps are the feature. They tell you where to look next.",
        ],
        quote: "A brief with three honest gaps beats a brief with three invented sentences, every single time.",
      },
      {
        h: "Cost and time",
        p: [
          "One brief runs about eleven assistant calls and takes four to six minutes end to end. Against a person doing the same job properly — reading, checking, writing — you are replacing perhaps ninety minutes of work with six, at the cost of needing to spot-check the citations, which takes ten.",
          "Do spot-check them. Roughly one link in twenty points at something that does not say quite what the brief claims it says. That rate is low enough to be useful and high enough that publishing unread would eventually embarrass you.",
        ],
      },
    ],
    blocks: [
      {
        type: "text",
        text: "Run the planner on a strong assistant and the writer on a cheaper one. The planner's quality determines everything downstream; the writer is mostly following orders.",
        preview: true,
      },
      {
        type: "long_text",
        text:
          "Spot-check protocol:\n\n1. Open three links at random from every brief.\n2. Search the page for the claimed fact.\n3. If it is not there verbatim or near-verbatim, mark the brief as unverified and re-run the gatherer with narrower questions.\n\nOne in twenty links being loose is normal. One in five means your questions were too broad and the gatherer settled for adjacent material.",
      },
      {
        type: "code",
        text: "planner_questions: 6\ngather_sources_per_question: 3\nwriter_may_use_own_knowledge: false\nunsupported_sentence_policy: delete",
      },
    ],
    results: [
      { kind: "written", text: "Twelve briefs produced for a consultancy over one month. Average production time 5m40s versus an estimated 90 minutes manually. Two briefs required re-running after spot-checks failed.", caption: "One month, twelve briefs" },
    ],
  },
  {
    key: "support-replies",
    title: "Support replies that sound like your team, not like a robot",
    post_type: "blueprint",
    content_type: "Agent Blueprint",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT"],
    topics: ["Business", "Productivity"],
    use_cases: ["Business", "Email"],
    custom_tags: ["support", "tone", "drafting"],
    desc:
      "Drafts, never sends. Learns your voice from twenty past replies rather than from a personality description you made up.",
    author: 5,
    daysAgo: 18,
    monetisation: "free",
    cover: COVERS[4],
    metrics: { views: 7420, downloads: 890, rating: 4.3, ratings: 96 },
    sections: [
      {
        h: "Stop describing your tone",
        p: [
          "Everybody's first attempt includes a line like \"write in a friendly but professional tone\". This produces the exact bland voice you were trying to avoid, because that phrase describes roughly ninety percent of all business writing ever produced.",
          "Instead, paste in twenty of your own past replies. Real ones, including the slightly short ones you sent when you were busy. The assistant will pick up your actual habits — that you open with the customer's first name, that you never apologise twice, that you sign off with \"shout if that doesn't work\" — far more accurately than any adjective you could supply.",
        ],
      },
      {
        h: "The setup",
        p: [
          "One instruction, twenty examples, and a hard rule that it drafts into a draft folder and never sends. The drafting-only constraint is not paranoia; it is what makes the thing adoptable. Nobody in a support team will accept a setup that can email customers on its own, and they are right not to.",
          "Give it the customer's message, the customer's history if you have it, and your twenty examples. Ask for two draft variants — one short, one thorough. The person picks in about three seconds, which is far faster than editing a single mediocre draft.",
        ],
        bullets: [
          "Twenty real past replies, pasted in full.",
          "Two variants per message: short and thorough.",
          "Drafts folder only. No send permission, ever.",
          "Refresh the examples every couple of months.",
        ],
      },
      {
        h: "What it gets wrong",
        p: [
          "It over-apologises on anything that mentions a delay. Adding \"apologise at most once per reply, never twice\" fixed it in one line. It also occasionally promises a timeframe that nobody agreed to, which is why the drafting-only rule matters — a human reads every one of these before it leaves.",
          "The genuine surprise was tone drift on angry messages. Faced with a furious customer it becomes noticeably more formal, which reads as cold. Telling it explicitly to keep the same warmth regardless of the customer's tone made a bigger difference to satisfaction scores than anything else I changed.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Twenty examples is the number where quality plateaus. Ten is noticeably worse. Fifty is no better than twenty and costs more on every single call.", preview: true },
      { type: "code", text: "examples: 20\nvariants: 2\nsend_permission: false\napology_limit: 1\ntone_matches_customer: false" },
    ],
  },
  {
    key: "spreadsheet-cleaner",
    title: "The spreadsheet cleaner that explains every change it made",
    post_type: "blueprint",
    content_type: "Workflow Template",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Zapier"],
    topics: ["Finance", "Productivity"],
    use_cases: ["Finance", "Business"],
    custom_tags: ["spreadsheets", "data", "finance"],
    desc:
      "Messy exports in, tidy table out, plus a change log so you can see exactly what it touched. Built for month-end, when nobody has time to double-check silently.",
    author: 4,
    daysAgo: 21,
    monetisation: "pwyw",
    cover: COVERS[5],
    metrics: { views: 6180, downloads: 640, rating: 4.6, ratings: 71 },
    sections: [
      {
        h: "The month-end problem",
        p: [
          "Three systems export three different date formats, two of them put the supplier name in a field with a reference number glued to the front, and one of them helpfully rounds to whole pounds. Every month somebody spends two hours making those agree with each other before the real work starts.",
          "This setup does that cleaning, and — the part that makes it usable in finance — writes a line for every change it made. Without the change log you have a black box touching numbers that go into accounts, which no sensible finance person will sign off on.",
        ],
      },
      {
        h: "How it works",
        p: [
          "Process one row at a time rather than handing over the whole file. It is slower and it costs slightly more, and it is worth both, because a single-row failure is visible and a whole-file failure quietly shifts every column by one and you find out in March.",
          "For each row: normalise the date, split the supplier field, standardise the currency to two decimal places, and flag anything that looks wrong rather than fixing it. Flagging over fixing is the rule. If the amount is negative on an invoice, that is not a formatting problem, that is something for a human.",
        ],
        code: {
          lang: "text",
          text: `Clean one row. Return JSON only.

{
  "date": "YYYY-MM-DD",
  "supplier": "name only, no reference numbers",
  "reference": "extracted reference, or null",
  "amount": "number, 2dp",
  "currency": "3-letter code",
  "changes": ["one line per change you made"],
  "flags": ["anything suspicious you did NOT fix"]
}

Never invent a missing value. Use null and add a flag.

ROW: {{row}}`,
        },
      },
      {
        h: "Results across six months of ledgers",
        p: [
          "Across roughly 4,200 rows it cleaned 4,061 without a flag, flagged 139 and got 6 wrong. All six wrong ones were the same failure: a supplier whose legal name contains a number, which it stripped as a reference. Adding two examples of that supplier to the instruction fixed it permanently.",
          "Two hours a month became about twelve minutes, most of which is reading the flags. The change log has been opened exactly twice, but its existence is why the setup got approved at all.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Pay what you want. If it saves your month-end, throw a few pounds at it; if it doesn't fit your ledgers, take it for nothing and tell me what broke.", preview: true },
      { type: "code", text: "mode: row_by_row\non_missing: null_plus_flag\non_suspicious: flag_not_fix\nchange_log: required" },
    ],
    results: [
      { kind: "written", text: "4,200 rows across six monthly ledgers. 4,061 clean, 139 flagged, 6 incorrect (all one supplier, since fixed). Month-end prep down from ~2 hours to ~12 minutes.", caption: "Six months of production use" },
    ],
  },
  {
    key: "local-model-setup",
    title: "Running a capable assistant on your own laptop, honestly assessed",
    post_type: "blueprint",
    content_type: "Model Config Guide",
    difficulty: "Intermediate",
    ai_tools: ["Any Tool"],
    topics: ["Learning", "Research"],
    use_cases: ["Learning", "Research"],
    custom_tags: ["local", "privacy", "hardware"],
    desc:
      "What actually runs on 16GB of memory, what it is genuinely good at, and the four jobs you should not give it. Written after a month of using nothing else.",
    author: 3,
    daysAgo: 26,
    monetisation: "free",
    cover: COVERS[6],
    metrics: { views: 11200, downloads: 1490, rating: 4.6, ratings: 174 },
    sections: [
      {
        h: "Why you might want this",
        p: [
          "Two reasons hold up. The first is confidentiality — if your documents cannot leave the building, the argument ends there. The second is cost predictability at high volume, where a laptop that has already been bought beats a per-word bill.",
          "The reason that does not hold up is quality. A model running on your laptop in 2026 is roughly where the good hosted assistants were in early 2024. That is genuinely useful and it is not the same thing, and pretending otherwise is how people end up disappointed after a weekend of setup.",
        ],
      },
      {
        h: "What to install",
        p: [
          "Install a local runner, pull a mid-sized model, and give it a folder of your own documents to work with. On a 16GB machine you are looking at somewhere around a 7-to-9 billion parameter model at four-bit quantisation. Bigger will technically load and will then swap to disk and produce one word every few seconds, which is not a working setup.",
          "Budget about twenty minutes for the download and five for the first run. Close your browser before the first test. Watching memory pressure while a hundred tabs are open teaches you nothing except that browsers are hungry.",
        ],
        bullets: [
          "16GB memory: a ~7B model at 4-bit. Comfortable.",
          "32GB: a ~13B model. Noticeably better at following long instructions.",
          "8GB: possible, but only for short tasks. Expect frustration.",
          "Apple silicon runs these markedly better than equivalent-priced x86 laptops.",
        ],
      },
      {
        h: "Four jobs it is good at, four it is not",
        p: [
          "Good at: summarising a document you already have, rewriting text to a different length, extracting structured fields from messy text, and answering questions where the answer is definitely in the text you provided. Note that all four are closed-book — the material is in front of it.",
          "Bad at: anything requiring knowledge it was not given, multi-step reasoning across several documents, writing code that runs first time, and any task where being subtly wrong is expensive. It fails these gracefully-looking, which is the dangerous part — the output looks the same whether it is right or not.",
        ],
        quote: "Local models are excellent readers and unreliable experts. Give them the book.",
      },
      {
        h: "The month I used nothing else",
        p: [
          "I forced myself onto a local model exclusively for four weeks. Summarising and extraction: no meaningful difference from hosted, I stopped noticing. Drafting: noticeably flatter, more editing, but workable. Anything analytical: I gave up in week two and stopped pretending.",
          "The honest conclusion is that a laptop model handles perhaps sixty percent of my actual usage at zero marginal cost and perfect confidentiality, and that the other forty percent is where most of the value lives.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "No hardware recommendations with affiliate links here. If your laptop is from the last three years and has 16GB, it will work. If it has 8GB, spend the twenty minutes finding out before you spend a weekend.", preview: true },
      { type: "code", text: "memory_16gb: 7B-9B @ 4bit\nmemory_32gb: 13B @ 4bit\ncontext_window: keep under 8k for usable speed\nbatch: 1" },
    ],
  },
  {
    key: "social-repurpose",
    title: "One long piece into a fortnight of posts, without the sludge",
    post_type: "blueprint",
    content_type: "Workflow Template",
    difficulty: "Beginner",
    ai_tools: ["Claude", "Make"],
    topics: ["Content", "Social Media"],
    use_cases: ["Social Media", "Content"],
    custom_tags: ["social", "repurposing", "writing"],
    desc:
      "Splits a long article into fourteen posts that each stand alone. Includes the constraint list that stops it producing engagement-bait.",
    author: 2,
    daysAgo: 30,
    monetisation: "subscription",
    cover: COVERS[7],
    metrics: { views: 8130, downloads: 720, rating: 4.2, ratings: 88 },
    sections: [
      {
        h: "The sludge problem",
        p: [
          "Ask any assistant to turn an article into social posts and you get fourteen variations of \"Here's what most people get wrong about X 🧵\". It is not that the posts are badly written. It is that they all have the same shape, and that shape is instantly recognisable as machine-made.",
          "The fix is a constraint list that bans the shapes rather than describing the goal. Banning is more effective than requesting, because \"write naturally\" means nothing while \"never open with a question\" is checkable.",
        ],
      },
      {
        h: "The constraint list",
        p: [
          "This list took a while to assemble and it is the entire value of this setup. Each line came from noticing the same tic for the fourth time.",
        ],
        code: {
          lang: "text",
          text: `Write 14 standalone posts from the article below.

Never:
- open with a question
- use the words "unlock", "leverage", "game-changer", "here's the thing"
- start with "Most people"
- end with "What do you think?"
- use emoji as bullet points
- write a thread; each post stands alone
- number them as "1/14"

Always:
- lead with the specific claim, not the setup
- include one concrete number or example per post
- stay under 60 words

ARTICLE: {{article}}`,
        },
      },
      {
        h: "Picking the seven that are any good",
        p: [
          "Fourteen posts will contain roughly seven usable ones, four that need a rewrite of the opening line, and three that are restating the same point. That ratio has been remarkably stable across about sixty articles.",
          "Do not try to fix the ratio with a better instruction. Generate fourteen, keep seven, publish those over a fortnight. Trying to get fourteen good ones in one pass produces fourteen mediocre ones.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Subscriber setup. The constraint list gets updated whenever a new tic shows up — most recently 'it's not X, it's Y' which spread everywhere in about six weeks.", preview: true },
      { type: "code", text: "posts_generated: 14\nexpected_usable: 7\nmax_words: 60\nthreads: false" },
    ],
  },
  {
    key: "voice-notes",
    title: "Voice notes to a tidy weekly note, for people who think out loud",
    post_type: "blueprint",
    content_type: "Agent Blueprint",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Zapier"],
    topics: ["Productivity", "Learning"],
    use_cases: ["Productivity", "Hobby"],
    custom_tags: ["voice", "notes", "weekly"],
    desc:
      "Ramble into your phone during the week, get one organised note on Friday that keeps your actual phrasing instead of flattening it into corporate prose.",
    author: 6,
    daysAgo: 34,
    monetisation: "free",
    cover: COVERS[8],
    metrics: { views: 4460, downloads: 511, rating: 4.4, ratings: 62 },
    sections: [
      {
        h: "Why the phrasing matters",
        p: [
          "Most transcription-plus-summary setups produce something that reads like minutes of a meeting you did not attend. All the texture goes: the half-formed idea you circled three times, the thing you said with obvious irritation, the phrase you reached for that turned out to be the good one.",
          "This setup is instructed to organise without rewriting. It groups related thoughts, drops repetition and false starts, and otherwise leaves your words alone. The output sounds like you on a good day rather than like a consultant.",
        ],
      },
      {
        h: "Setting it up",
        p: [
          "Record voice memos as normal. A watched folder syncs them. Each memo is transcribed on arrival and stored with its date. On Friday afternoon one job takes the week's transcripts and produces a single note, grouped by theme rather than by day, because thinking rarely respects the calendar.",
          "The one setting that matters: tell it to keep direct quotes for anything that sounded like a decision or a strong opinion, and to compress everything else. That split is what keeps the note both short and recognisably yours.",
        ],
        code: {
          lang: "text",
          text: `Organise this week's voice notes into one document.

Rules:
- Group by theme, not by date
- Preserve the speaker's exact wording for decisions and strong opinions
- Compress rambling, repetition and false starts
- Do not add transitions, conclusions or anything not said
- Mark unfinished thoughts as [unfinished] rather than completing them

TRANSCRIPTS: {{week}}`,
        },
      },
      {
        h: "The [unfinished] tag",
        p: [
          "That one instruction changed how useful this is. Half of what you say into a phone is a thought that ran out of road. Marking those instead of tidying them into false completeness gives you a Friday list of exactly the things worth thinking about again.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Works with any transcription. Trim silences over five seconds first — quiet stretches are where transcription invents sentences you never said.", preview: true },
      { type: "code", text: "group_by: theme\npreserve_quotes: decisions_and_opinions\nunfinished_marker: true\nrun: friday 16:00" },
    ],
  },

  // ────────────────────────── TECHNIQUES (7) ──────────────────────────
  {
    key: "worked-examples",
    title: "Three worked examples beat any amount of instruction",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Claude", "Gemini"],
    topics: ["Learning", "Productivity"],
    use_cases: ["Productivity", "Learning"],
    custom_tags: ["prompting", "examples", "basics"],
    desc:
      "The single highest-return change most people can make: delete half your instructions and paste in three examples of the output you want.",
    author: 2,
    daysAgo: 1,
    monetisation: "free",
    cover: COVERS[9],
    metrics: { views: 15600, downloads: 2210, rating: 4.8, ratings: 268 },
    sections: [
      {
        h: "The experiment",
        p: [
          "I took one task — turning a product description into a short listing — and wrote two versions. Version A was 340 words of careful instruction: tone, length, what to include, what to avoid, formatting. Version B was 40 words of instruction plus three examples of finished listings.",
          "Fifty products through each. Version B produced output I would publish untouched 41 times. Version A managed 22. Same assistant, same products, same afternoon.",
        ],
      },
      {
        h: "Why examples win",
        p: [
          "Instructions describe. Examples demonstrate. When you write \"keep the tone conversational but not chatty\", you are asking the assistant to guess where your line sits between two words that mean almost the same thing. When you show it three listings you are happy with, the line is simply visible.",
          "Examples also carry things you would never think to write down: that you always mention the size before the material, that you never use exclamation marks, that your listings end on a benefit rather than a feature. Nobody writes those rules because nobody knows they follow them.",
        ],
        bullets: [
          "Three examples is the sweet spot. Two is unstable; five is no better than three.",
          "Use real outputs you were happy with, not invented ideal ones.",
          "Include one slightly awkward case — it teaches the edges.",
          "Keep 40-60 words of instruction for the hard constraints only.",
        ],
      },
      {
        h: "The template",
        p: [
          "Keep instructions for things examples cannot show: hard limits, forbidden words, required fields. Everything else, delete and demonstrate.",
        ],
        code: {
          lang: "text",
          text: `Write a product listing in the same style as the examples.

Hard rules: under 80 words. Never use "perfect for". Always state the size.

EXAMPLE 1
Input: {{input_1}}
Output: {{output_1}}

EXAMPLE 2
Input: {{input_2}}
Output: {{output_2}}

EXAMPLE 3
Input: {{input_3}}
Output: {{output_3}}

NOW
Input: {{input}}
Output:`,
        },
      },
      {
        h: "When it does not work",
        p: [
          "Examples fail when the task has no consistent output shape. If every answer is structurally different — open-ended analysis, for instance — three examples teach it a shape that does not exist and it will force the next answer into that shape anyway.",
          "The test is simple: could a new colleague learn this job by seeing three finished pieces? If yes, use examples. If they would need the reasoning explained, use instructions.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Costs slightly more per call because the examples are sent every time. On anything you run less than a few thousand times a month this is irrelevant next to the quality difference.", preview: true },
      { type: "code", text: "examples: 3\ninstruction_words: 40-60\ninclude_awkward_case: true\nreplace_tone_descriptions: yes" },
    ],
    results: [
      { kind: "written", text: "50 products, two prompt versions. Instruction-heavy: 22/50 publishable untouched. Example-led: 41/50. Same model, same session.", caption: "Head-to-head test" },
    ],
  },
  {
    key: "refusal-clause",
    title: "The refusal clause: teaching a setup to say it doesn't know",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Intermediate",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Research", "Business"],
    use_cases: ["Research", "Business"],
    custom_tags: ["accuracy", "prompting", "trust"],
    desc:
      "One paragraph that converts a confident guesser into something you can rely on. Includes the exact wording and the three ways people get it subtly wrong.",
    author: 3,
    daysAgo: 4,
    monetisation: "free",
    cover: COVERS[0],
    metrics: { views: 12400, downloads: 1680, rating: 4.9, ratings: 201 },
    sections: [
      {
        h: "The failure it fixes",
        p: [
          "Given material that does not contain the answer, an assistant will almost always produce an answer anyway. Not out of malice — it is completing a pattern, and the pattern of a question is an answer. The output is fluent, plausible and unrelated to your documents.",
          "You cannot fix this by asking for accuracy. \"Be accurate\" is not an instruction it can follow, because it does not experience being inaccurate. You fix it by giving it a specific, easy, permitted alternative action.",
        ],
      },
      {
        h: "The wording",
        p: [
          "The exact phrasing matters more than seems reasonable. Three things must be present: a literal string to output, permission to use it, and an explicit ban on reasoning toward an answer.",
        ],
        code: {
          lang: "text",
          text: `If the provided material does not contain the answer, reply with
exactly this sentence and nothing else:

"Not stated in the material provided."

Do not reason toward an answer. Do not use your own knowledge.
Do not offer a likely answer with a caveat. Do not suggest where
the answer might be found. Refusing is a correct and complete answer.`,
        },
      },
      {
        h: "Three ways people get it wrong",
        p: [
          "First: making the refusal vague. \"Say you don't know if unsure\" leaves it deciding what unsure means, and it is almost never unsure. Give it a literal string to output.",
          "Second: forgetting to ban the hedge. Without an explicit ban you get \"The material does not state this directly, however it is likely that…\", which is the original problem wearing a hat. Everything after \"however\" is invented.",
          "Third: putting the clause at the end of a long instruction. Instructions near the end of a very long prompt get less weight. Put the refusal clause immediately after the task description, before the material.",
        ],
        bullets: [
          "Give a literal sentence, not a concept.",
          "Ban hedged answers explicitly.",
          "Place it early, not as a footnote.",
          "State that refusing is correct — otherwise it treats refusal as failure.",
        ],
      },
      {
        h: "Measured effect",
        p: [
          "Forty questions against a document set, twelve of which had no answer in the material. Without the clause: two correct refusals out of twelve, ten confident inventions. With it: eleven correct refusals, one hedge that slipped through.",
          "The cost is a small number of over-refusals — three questions that were answerable came back refused, because the answer required combining two sentences from different pages. That trade is worth taking almost everywhere.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Paste this into any setup that reads documents. It is the single highest-value paragraph on this site and it takes ten seconds to add.", preview: true },
      { type: "code", text: "position: immediately_after_task\nliteral_string: required\nban_hedging: required\nexpected_over_refusal_rate: ~7%" },
    ],
    results: [
      { kind: "written", text: "40 questions, 12 unanswerable from the material. Without refusal clause: 2/12 correct refusals. With it: 11/12. Over-refusal cost: 3 answerable questions refused.", caption: "Controlled comparison" },
    ],
  },
  {
    key: "two-pass",
    title: "Two passes beat one clever one",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Intermediate",
    ai_tools: ["ChatGPT", "Claude"],
    topics: ["Productivity", "Research"],
    use_cases: ["Productivity", "Business"],
    custom_tags: ["prompting", "checking", "quality"],
    desc:
      "Generate, then check with fresh eyes. Doubles your cost and cuts obvious errors by roughly two thirds — the arithmetic usually works out.",
    author: 0,
    daysAgo: 8,
    monetisation: "free",
    cover: COVERS[1],
    metrics: { views: 9130, downloads: 1040, rating: 4.6, ratings: 141 },
    sections: [
      {
        h: "Why one pass struggles",
        p: [
          "An assistant writing an answer is committed to it by the third sentence. Everything after that is built on what came before, including the mistakes. Asking it to be careful while writing does not help much, because it cannot see the finished thing while producing it.",
          "A second pass with the checking instruction only — no memory of having written it — behaves like a different reader. It finds things the writer could not, for the same reason you spot typos in someone else's email and not your own.",
        ],
      },
      {
        h: "How to structure it",
        p: [
          "Pass one produces the output. Pass two receives the original request and the output, with an instruction to find specific categories of problem rather than to 'review'. Vague review instructions produce vague compliments.",
          "Crucially, pass two should return findings, not a rewrite. If you let it rewrite, it rewrites the voice too and you lose whatever was good about pass one. Take the findings and apply them, or run a narrow third pass that fixes only the listed items.",
        ],
        code: {
          lang: "text",
          text: `Check the output below against the request. Find only these:

1. Claims not supported by the provided material
2. Numbers that do not appear in the source
3. Instructions from the request that were not followed
4. Internal contradictions

Return a list. Do not rewrite. If you find nothing, say "No issues found."

REQUEST: {{request}}
MATERIAL: {{material}}
OUTPUT: {{output}}`,
        },
      },
      {
        h: "Is it worth double the cost",
        p: [
          "On 200 generated summaries, single-pass produced 31 with a factual problem. Two-pass produced 11. That is a two-thirds reduction for exactly double the spend.",
          "Worth it when a mistake costs more than the call — anything client-facing, anything financial, anything published. Not worth it for internal drafts you were going to read carefully anyway. The rule I use: if a human is definitely reading it closely before it matters, skip the second pass.",
        ],
        quote: "The checker cannot be the writer. Different instruction, no memory, fresh read — that is the whole trick.",
      },
    ],
    blocks: [
      { type: "text", text: "Run the checker on a cheaper assistant than the writer. Checking against provided material is a much easier job than producing good prose, and the cost saving makes the arithmetic more comfortable.", preview: true },
      { type: "code", text: "pass_1: generate\npass_2: check_only\npass_2_may_rewrite: false\nfinding_categories: 4" },
    ],
  },
  {
    key: "temperature-ladder",
    title: "The temperature ladder, for anything creative",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Beginner",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Content", "Hobby"],
    use_cases: ["Content", "Hobby"],
    custom_tags: ["creative", "writing", "settings"],
    desc:
      "Run the same creative request at five settings and pick. Takes two extra minutes and consistently beats hunting for the perfect prompt.",
    author: 2,
    daysAgo: 12,
    monetisation: "free",
    cover: COVERS[2],
    metrics: { views: 6740, downloads: 580, rating: 4.3, ratings: 79 },
    sections: [
      {
        h: "Stop tuning, start sampling",
        p: [
          "People spend an hour rewriting a creative prompt when the actual variance between attempts is larger than the variance between prompts. Run the same request five times at increasing randomness and you will see the range of what is available to you in about ninety seconds.",
          "The low-randomness versions come back competent and slightly dull. The high ones come back with one great line surrounded by rubbish. The useful move is usually taking the great line from the wild one and the structure from the safe one.",
        ],
      },
      {
        h: "The ladder",
        p: [
          "Five runs at 0.3, 0.6, 0.9, 1.1 and 1.3 where your tool exposes the setting. Where it does not, approximate by asking for a 'conventional', 'standard', and 'unexpected' version — cruder, but it captures most of the effect.",
        ],
        bullets: [
          "0.3 — safe, predictable, useful as a structural skeleton.",
          "0.6 — the default most tools use. Fine, forgettable.",
          "0.9 — where interesting phrasing starts appearing.",
          "1.1 — one good idea, some incoherence. Mine this one.",
          "1.3 — mostly unusable, occasionally brilliant. Read it anyway.",
        ],
      },
      {
        h: "Reading the results",
        p: [
          "Do not judge the runs as complete pieces. Read them looking for individual sentences worth stealing. Across sixty or so uses, the sentence I ended up keeping came from the 1.1 run about half the time, from 0.9 about a third, and from the low ones almost never.",
          "This also tells you something useful about the task. If all five runs look basically the same, the task is more constrained than you thought and you should stop treating it as creative work.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Five runs of a short creative prompt costs about the same as one long analytical call. This is cheap in every sense that matters.", preview: true },
      { type: "code", text: "temperatures: [0.3, 0.6, 0.9, 1.1, 1.3]\nread_for: individual_lines\ncombine: structure_from_low + phrasing_from_high" },
    ],
  },
  {
    key: "structured-output",
    title: "Getting reliable structured output without the retry loop",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Intermediate",
    ai_tools: ["ChatGPT", "Claude", "Gemini"],
    topics: ["Productivity", "Business"],
    use_cases: ["Business", "Productivity"],
    custom_tags: ["json", "structure", "reliability"],
    desc:
      "Why your JSON breaks one time in twenty, and the four changes that take it to about one in five hundred.",
    author: 1,
    daysAgo: 16,
    monetisation: "free",
    cover: COVERS[3],
    metrics: { views: 8910, downloads: 970, rating: 4.7, ratings: 118 },
    sections: [
      {
        h: "The one-in-twenty problem",
        p: [
          "Ask for JSON and you get valid JSON most of the time. The failures are the interesting part: a trailing comma, a helpful sentence before the opening brace, a value that should be a number arriving as \"about 40\", or the whole thing wrapped in a code fence you did not ask for.",
          "At small volumes you shrug and retry. At a few thousand a day, one in twenty is a hundred failures and a support problem. All four failure modes have specific fixes.",
        ],
      },
      {
        h: "The four fixes",
        p: [
          "One: show the exact shape rather than describing it. A schema in prose gets interpreted; a filled-in example gets copied. Two: forbid the preamble explicitly — \"return JSON only, no explanation, no code fence\" removes the two most common wrappers.",
          "Three: for every field, say what to do when the value is missing. Unstated, it invents something plausible. Stated, it uses null. Four: constrain enumerated fields to a literal list in the prompt, because free-text categories drift into synonyms within a few hundred calls.",
        ],
        code: {
          lang: "text",
          text: `Return JSON only. No explanation. No code fence.

Exact shape (copy this structure):
{
  "status": "one of: open | closed | pending",
  "amount": 1250.00,
  "due": "2026-03-01",
  "notes": null
}

Missing values must be null. Never guess. Never add fields.
"status" must be one of the three listed strings exactly.

INPUT: {{input}}`,
        },
      },
      {
        h: "The measurement",
        p: [
          "Before: 2,000 calls, 96 invalid or unusable, a 4.8% failure rate. After the four changes: 2,000 calls, 4 failures, all of them the same edge case where the input was empty. Adding a length check before sending removed those too.",
          "One thing that did not help: asking it to double-check the JSON before returning. That produced valid JSON containing an apology field.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "If your tool offers a native structured-output mode, use it and treat this as the backup for tools that don't. The prompt-level fixes still help even when the mode is on.", preview: true },
      { type: "code", text: "show_filled_example: true\nforbid_preamble: true\nnull_policy: explicit\nenums: literal_list_in_prompt" },
    ],
    results: [
      { kind: "written", text: "2,000 calls before: 96 unusable (4.8%). 2,000 after the four fixes: 4 unusable (0.2%), all from empty inputs.", caption: "Production measurement" },
    ],
  },
  {
    key: "scoring-rubric",
    title: "A scoring rubric you can actually apply on a Tuesday",
    post_type: "blueprint",
    content_type: "Evaluation Framework",
    difficulty: "Intermediate",
    ai_tools: ["ChatGPT", "Claude"],
    topics: ["Business", "Research"],
    use_cases: ["Business", "Research"],
    custom_tags: ["evaluation", "quality", "measurement"],
    desc:
      "Twenty inputs, three questions each, one number. Enough rigour to catch real regressions, little enough ceremony that you will actually keep doing it.",
    author: 3,
    daysAgo: 20,
    monetisation: "pwyw",
    cover: COVERS[4],
    metrics: { views: 5590, downloads: 430, rating: 4.5, ratings: 54 },
    sections: [
      {
        h: "Why elaborate evaluation frameworks die",
        p: [
          "The thorough ones need a labelled dataset, agreement between two reviewers, and a spreadsheet nobody owns. They get built once, used twice, and abandoned by the second month. An abandoned rigorous measure is worth less than a crude one you run weekly.",
          "This is the crude one. It takes about fifteen minutes and gives you a number that moves when quality moves, which is the only property that actually matters.",
        ],
      },
      {
        h: "The rubric",
        p: [
          "Keep a fixed set of twenty real inputs — real, from your actual usage, not invented. Run them. For each output answer three yes/no questions. Score is the count of yesses out of sixty.",
        ],
        bullets: [
          "Q1: Could I send this to the person who asked, without editing?",
          "Q2: Is every factual claim in it traceable to the material provided?",
          "Q3: Did it follow every explicit instruction in the request?",
        ],
      },
      {
        h: "Reading the number",
        p: [
          "Absolute values are meaningless across different tasks. What matters is your own history. Record the score with the date and a one-line note on what changed. When a score drops five points without you changing anything, the assistant underneath you changed, and you now have evidence rather than a feeling.",
          "Run it monthly, and before and after any change to your instructions. Anything under a three-point move is noise — I have re-run the identical setup on the same twenty inputs and seen two-point swings.",
        ],
        quote: "The value is not the score. It is having a number from six weeks ago to compare it to.",
      },
    ],
    blocks: [
      { type: "text", text: "Twenty inputs is enough to be stable and small enough to review by hand in a quarter of an hour. Thirty is not meaningfully better. Ten is too noisy.", preview: true },
      { type: "code", text: "inputs: 20\nquestions: 3\nmax_score: 60\ncadence: monthly + before/after changes\nnoise_threshold: 3 points" },
    ],
  },
  {
    key: "layered-instructions",
    title: "Layering instructions so you can change one thing safely",
    post_type: "blueprint",
    content_type: "Prompt File",
    difficulty: "Advanced",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Business", "Productivity"],
    use_cases: ["Business", "Productivity"],
    custom_tags: ["prompting", "maintenance", "structure"],
    desc:
      "Once your instructions pass 300 words, editing them becomes dangerous. Four fixed layers make changes local instead of terrifying.",
    author: 0,
    daysAgo: 24,
    monetisation: "paid",
    price: 8,
    cover: COVERS[5],
    metrics: { views: 4020, downloads: 260, rating: 4.6, ratings: 38 },
    sections: [
      {
        h: "The maintenance problem",
        p: [
          "A long instruction that grew organically over six months has rules scattered through it, some contradicting each other, and nobody remembers why the fourth paragraph says what it says. Changing anything risks breaking something unrelated, so people stop changing it and it slowly stops fitting the job.",
          "Layering fixes this by giving every rule exactly one correct home. When you need to change how it handles missing data, you know which of four sections to open, and you know that section does not affect tone.",
        ],
      },
      {
        h: "The four layers",
        p: [
          "Always in this order, always with these headers, even when a layer is two lines long. The consistency is the point — six months later you can find things.",
        ],
        bullets: [
          "ROLE — who it is and what job it is doing. Two sentences, rarely changes.",
          "RULES — hard constraints and refusals. Changes when something goes wrong.",
          "SHAPE — the output format, with a filled example. Changes when downstream changes.",
          "MATERIAL — the actual input. Changes every call.",
        ],
        code: {
          lang: "text",
          text: `## ROLE
You review supplier invoices for a small finance team.

## RULES
- Never state an amount not present in the document.
- If a field is unreadable, output null and flag it.
- Refuse with "Not stated in the document" rather than inferring.

## SHAPE
{ "supplier": "", "amount": 0.00, "due": "YYYY-MM-DD", "flags": [] }

## MATERIAL
{{document}}`,
        },
      },
      {
        h: "What this buys you",
        p: [
          "Two concrete things. Changes become local, so a tone tweak cannot accidentally remove a refusal rule. And diffs become readable — when a colleague changes the instruction you can see at a glance whether they touched behaviour or formatting.",
          "The cost is a small amount of verbosity on every call. Trivial next to the cost of an instruction nobody dares edit.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Includes six layered instructions from setups I run in production, as starting points: invoice review, support drafting, contract Q&A, meeting actions, research briefs, listing writing.", preview: true },
      { type: "code", text: "layers: [ROLE, RULES, SHAPE, MATERIAL]\norder: fixed\nheaders: literal\nempty_layers: keep_header" },
    ],
  },

  // ────────────────────────── DISCOVERIES (6) ──────────────────────────
  {
    key: "silent-truncation",
    title: "Long inputs get silently trimmed and nothing warns you",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Any",
    ai_tools: ["ChatGPT", "Claude", "Gemini"],
    topics: ["Research", "Business"],
    use_cases: ["Research", "Business"],
    custom_tags: ["failure", "truncation", "limits"],
    desc:
      "Sent 90 pages, got an answer based on 40. No error, no warning, no sign in the output. How I found it and the two-line check that catches it.",
    author: 3,
    daysAgo: 3,
    monetisation: "free",
    cover: COVERS[6],
    metrics: { views: 18300, downloads: 940, rating: 4.9, ratings: 240 },
    sections: [
      {
        h: "How I noticed",
        p: [
          "A document Q&A setup that had been reliable for months started missing things. Not getting them wrong — missing them, as though the text was not there. The pattern took a while to see because the answers were still well-formed and confident.",
          "Eventually I put a unique nonsense phrase on the last page of a long document and asked whether it appeared. It said no. It appeared on page 88 of 90. The last fifty pages were never read.",
        ],
      },
      {
        h: "What is actually happening",
        p: [
          "Every assistant has a limit on how much it can hold at once. When you exceed it, some tools error, but many silently drop the overflow — usually the middle or the end — and answer from what fits. From your side the response looks identical to a normal one.",
          "It got worse over time in my case not because anything changed, but because the document folder kept growing. The failure arrives quietly on the day your input crosses the line, which is why it is so hard to attribute.",
        ],
        bullets: [
          "No error is raised. The response looks completely normal.",
          "The dropped section is usually the middle or the tail.",
          "Growing document sets cross the limit gradually — no obvious trigger day.",
          "Retrieval setups hide it, because they send only some chunks anyway.",
        ],
      },
      {
        h: "The canary check",
        p: [
          "Put a unique marker at the very end of whatever you send, and ask for it back as a field in the output. If it comes back wrong or missing, your input was trimmed and the answer is unreliable. Two lines, catches it every time.",
        ],
        code: {
          lang: "text",
          text: `...end of material...

CANARY: zx-7741-quail

Include the canary value in your response as {"canary": "..."}.
If you cannot see it, say so.`,
        },
      },
      {
        h: "The fix",
        p: [
          "Do not send more. Split the material into pieces that comfortably fit, answer each separately, then combine the answers in a second call. Slower, more calls, and correct.",
          "Combining answers is its own small trap — tell the combiner that disagreements between pieces must be reported rather than resolved. Silently picking one is how you get a confident answer built from half the evidence, which is exactly where you started.",
        ],
        quote: "Anything that fails silently will fail for months before you notice. Add the canary.",
      },
    ],
    blocks: [
      { type: "text", text: "Verified on three major assistants in March 2026. Two dropped the tail, one dropped the middle. All three answered confidently with no indication anything was missing.", preview: true },
      { type: "code", text: "canary_position: end_of_material\nreturn_as: field\non_mismatch: treat_answer_as_invalid\nsplit_target: 60% of stated limit" },
    ],
    results: [
      { kind: "written", text: "90-page document, unique phrase on page 88. Assistant reported it was absent. Canary check added across four production setups; two were found to be silently truncating daily.", caption: "Reproduction and fallout" },
    ],
  },
  {
    key: "silence-hallucination",
    title: "Transcription invents whole sentences during silence",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Any",
    ai_tools: ["Any Tool"],
    topics: ["Productivity", "Learning"],
    use_cases: ["Productivity", "Other"],
    custom_tags: ["failure", "audio", "transcription"],
    desc:
      "Nine seconds of room noise became a sentence nobody said, and it went into meeting notes. Reproduced across three services.",
    author: 6,
    daysAgo: 7,
    monetisation: "free",
    cover: COVERS[7],
    metrics: { views: 10400, downloads: 380, rating: 4.7, ratings: 128 },
    sections: [
      {
        h: "What happened",
        p: [
          "A recorded call had a nine-second gap while someone found a document. The transcript for that gap read \"Thanks for watching, don't forget to subscribe.\" It made it into the auto-generated notes and somebody asked about it in the follow-up meeting.",
          "That specific phrase is a giveaway — it is the kind of thing that appears constantly in training material scraped from video. The model, given nothing to transcribe, produces the most likely thing that follows silence in the material it learned from.",
        ],
      },
      {
        h: "Reproducing it",
        p: [
          "Record thirty seconds of an empty room. Transcribe it. I got a phrase on two out of three services, and got repeated fragments of the previous sentence on the third — which is arguably worse, because it looks plausible.",
          "It is not random. Longer silences produce longer inventions, and background noise makes it more likely, not less. A completely digital silence is safest; a quiet room with a fan is where it goes wrong.",
        ],
        bullets: [
          "Silences over ~5 seconds are the risk zone.",
          "Low-level background noise increases invention.",
          "Common inventions are stock video phrases and repeats of the prior line.",
          "Timestamps on the invented segment look completely normal.",
        ],
      },
      {
        h: "The fix",
        p: [
          "Strip silence before transcribing. Any audio tool can do this and it takes seconds. Cut anything under a volume threshold lasting more than two seconds, then transcribe the compressed audio.",
          "If you need accurate timestamps, do not cut — instead detect the silent regions first and blank the transcript for those ranges after transcription. More work, keeps the timing honest.",
        ],
        code: {
          lang: "text",
          text: `Pre-processing before transcription:

1. Detect regions below -45dB lasting > 2 seconds
2. Either: remove them (fast, timestamps shift)
   Or:    keep them and blank the transcript for those ranges
3. Transcribe
4. Reject any transcript segment containing known stock phrases:
   "thanks for watching", "subscribe", "see you next time"`,
        },
      },
    ],
    blocks: [
      { type: "text", text: "Tested on three widely used transcription services in February 2026. Two invented on empty-room audio; the third repeated the previous sentence. None flagged anything.", preview: true },
      { type: "code", text: "silence_threshold: -45dB\nmin_silence: 2s\nstock_phrase_filter: on\nrisk_zone: silences > 5s" },
    ],
  },
  {
    key: "cheaper-wins",
    title: "The cheap option beat the expensive one on our actual work",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Gemini", "Claude"],
    topics: ["Business", "Finance"],
    use_cases: ["Business", "Finance"],
    custom_tags: ["cost", "comparison", "benchmark"],
    desc:
      "On extraction tasks the budget tier matched the premium one and cost a fraction. On reasoning it was not close. The line between them is sharper than expected.",
    author: 4,
    daysAgo: 11,
    monetisation: "free",
    cover: COVERS[8],
    metrics: { views: 13800, downloads: 610, rating: 4.6, ratings: 165 },
    sections: [
      {
        h: "The test",
        p: [
          "Four hundred real tasks from our own logs, split into four categories: extraction, summarising, drafting and analysis. Every task run on both a premium and a budget option from the same family. Scored blind by two people using the three-question rubric.",
          "Extraction: budget 94%, premium 96%. Summarising: 89% versus 92%. Drafting: 71% versus 84%. Analysis: 43% versus 79%. The cost difference was roughly twelve to one.",
        ],
      },
      {
        h: "Where the line is",
        p: [
          "The pattern is not difficulty, it is whether the answer is present in the input. Extraction and summarising are reading jobs — the material contains the answer and the job is to find and shape it. Both tiers can read.",
          "Analysis requires combining things that are not stated together and holding several steps in mind. That is where the gap opens, and it opens dramatically rather than gradually. There is no gentle degradation; it is fine and then it is not.",
        ],
        bullets: [
          "Answer is in the text → use the cheap one.",
          "Answer requires combining separate facts → use the expensive one.",
          "Drafting sits in between; depends on how much you care about the prose.",
          "Never mix tiers within one job without measuring each step.",
        ],
      },
      {
        h: "What we changed",
        p: [
          "We routed by category. Extraction and summarising went to the budget tier, which is about seventy percent of our volume. Monthly bill dropped by just over half with no measurable quality change on those categories.",
          "The mistake we nearly made was routing by input length. Long inputs are not harder inputs. A ninety-page extraction is still extraction, and it ran perfectly well on the cheap tier.",
        ],
        quote: "Route by what the task requires, not by how big the input looks.",
      },
    ],
    blocks: [
      { type: "text", text: "Numbers are from our workload and will not transfer directly to yours. The method transfers: 400 real tasks, four categories, blind scoring, then route.", preview: true },
      { type: "code", text: "extraction: budget (94% vs 96%)\nsummarising: budget (89% vs 92%)\ndrafting: judgement (71% vs 84%)\nanalysis: premium (43% vs 79%)" },
    ],
    results: [
      { kind: "written", text: "400 tasks, blind double-scored. Routing extraction and summarising to the budget tier cut the monthly bill 54% with no measurable quality change in those categories.", caption: "Six-week evaluation" },
    ],
  },
  {
    key: "overlap-finding",
    title: "More overlap between chunks fixed retrieval more than any model change",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Intermediate",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Research", "Business"],
    use_cases: ["Research", "Business"],
    custom_tags: ["retrieval", "chunking", "finding"],
    desc:
      "Spent three weeks trying better models and clever re-ranking. The actual fix was raising chunk overlap from 10% to 25%.",
    author: 0,
    daysAgo: 15,
    monetisation: "free",
    cover: COVERS[9],
    metrics: { views: 9270, downloads: 520, rating: 4.8, ratings: 112 },
    sections: [
      {
        h: "The symptom",
        p: [
          "Document search that answered most questions well and then failed completely on a specific kind: anything where the answer spanned a definition and its consequence. \"What happens if we miss the deadline?\" would return the deadline clause but not the penalty, or the penalty with no context.",
          "I assumed a retrieval quality problem and spent three weeks on re-ranking, hybrid search and a better embedding approach. Marginal improvements, nothing that fixed the category.",
        ],
      },
      {
        h: "The actual cause",
        p: [
          "Chunks were split at 10% overlap. Definitions and their consequences are usually adjacent but not in the same paragraph, so the split repeatedly landed between them. Neither chunk contained the whole thought, so neither scored well against a question about the whole thought.",
          "Raising overlap to 25% meant most definition-consequence pairs appeared intact in at least one chunk. The failure category disappeared in a single afternoon.",
        ],
        bullets: [
          "10% overlap: 61% of spanning questions answered correctly.",
          "25% overlap: 88%.",
          "40% overlap: 89%, at significantly higher storage and retrieval cost.",
          "Non-spanning questions were unaffected throughout.",
        ],
      },
      {
        h: "The general lesson",
        p: [
          "When a system fails on a specific category of question rather than uniformly, the cause is almost always structural, not qualitative. A weaker model fails a bit at everything; a bad split fails completely at one thing.",
          "That distinction would have saved me three weeks. Now, when something fails, my first question is whether it fails uniformly or in a shape. Shaped failures point at the pipeline, not the model.",
        ],
        quote: "Uniform failure means the model. Shaped failure means your plumbing.",
      },
    ],
    blocks: [
      { type: "text", text: "25% is the number I would start at for prose documents. Code and tables want different handling entirely — split those on structural boundaries, not word counts.", preview: true },
      { type: "code", text: "chunk_size: 800 words\noverlap: 25%\nsweet_spot_tested: [10%, 25%, 40%]\nspanning_question_accuracy: 61% -> 88%" },
    ],
  },
  {
    key: "example-poisoning",
    title: "One bad example quietly poisons everything after it",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Intermediate",
    ai_tools: ["ChatGPT", "Claude"],
    topics: ["Content", "Business"],
    use_cases: ["Content", "Business"],
    custom_tags: ["failure", "examples", "prompting"],
    desc:
      "A single typo'd example in a set of five made 30% of outputs inherit the same mistake. Took a fortnight to trace.",
    author: 5,
    daysAgo: 19,
    monetisation: "free",
    cover: COVERS[0],
    metrics: { views: 7650, downloads: 340, rating: 4.7, ratings: 94 },
    sections: [
      {
        h: "The mystery",
        p: [
          "Product listings started including a stray double space before the price. Not all of them — roughly three in ten. No formatting step could have introduced it, the input data was clean, and the instruction said nothing about spacing.",
          "It came from example three of five, which I had pasted from a real listing that happened to contain a double space. The assistant treated it as a stylistic feature and reproduced it about a third of the time.",
        ],
      },
      {
        h: "Why it is hard to spot",
        p: [
          "Examples are read as demonstrations of everything, not just the parts you meant. Formatting, punctuation habits, capitalisation, length, even the order in which facts appear — all of it is signal. A typo is indistinguishable from an intentional style choice.",
          "It only appeared in a third of outputs because the other four examples voted against it. That partial rate is what made it look like randomness rather than a cause, and is why it took two weeks to find.",
        ],
        bullets: [
          "Anything present in an example may be copied, including mistakes.",
          "A minority-example artefact appears at a partial rate, which reads as noise.",
          "Copy-pasted real outputs are the highest-risk source of accidental artefacts.",
          "Proofread examples harder than you proofread instructions.",
        ],
      },
      {
        h: "How to check",
        p: [
          "Before adding an example, run it through the same checks you would apply to output you were about to publish. Then, once a quarter, diff a sample of outputs against the examples looking for shared oddities — repeated phrasings, identical sentence lengths, the same unusual punctuation.",
          "Since doing this I have found two more: a trailing full stop inside a quotation mark, and a habit of starting every third listing with the material rather than the product name.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "The audit takes ten minutes a quarter: sample twenty outputs, read them next to your examples, look for anything shared that you did not ask for.", preview: true },
      { type: "code", text: "audit_cadence: quarterly\nsample: 20 outputs\nlook_for: shared punctuation, shared openings, shared lengths" },
    ],
  },
  {
    key: "date-drift",
    title: "It quietly gets dates wrong when the year is missing",
    post_type: "blueprint",
    content_type: "Failure Library",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Claude", "Gemini"],
    topics: ["Finance", "Business"],
    use_cases: ["Finance", "Business"],
    custom_tags: ["failure", "dates", "finance"],
    desc:
      "\"Due 3rd March\" became 2025 in some rows and 2026 in others, in the same batch. The pattern behind which one it picks.",
    author: 4,
    daysAgo: 23,
    monetisation: "free",
    cover: COVERS[1],
    metrics: { views: 6320, downloads: 290, rating: 4.5, ratings: 76 },
    sections: [
      {
        h: "What we saw",
        p: [
          "Invoice extraction on a batch of 300 documents. Where the document wrote a date without a year — common on UK invoices — the extracted year varied. Same batch, same run, different years for identical phrasings.",
          "It was not random. When other text in the document mentioned a year, it used that. When nothing did, it chose based on whether the day-month combination had already passed relative to whatever it treated as today, which is not a stable reference point.",
        ],
      },
      {
        h: "Why this is worse than an error",
        p: [
          "A wrong year in a due date produces a valid-looking record. Nothing downstream complains. You find out when a payment is late by a year or when a report shows an inexplicable spike in a quarter that has not happened yet.",
          "Silent plausible errors in numeric fields are the most expensive category of failure, because every automated check passes and only a human reading carefully catches them.",
        ],
        bullets: [
          "Never let a date field be inferred. Extract or null, nothing in between.",
          "Pass the document's own date explicitly as context.",
          "Flag any date more than 90 days from the document date for review.",
          "Store the raw string alongside the parsed date, always.",
        ],
      },
      {
        h: "The fix",
        p: [
          "Two changes. Instruct it to return null plus a flag when the year is not stated in the document, rather than resolving it. And pass the invoice date as an explicit field so any relative reasoning has a fixed anchor.",
          "Nulls went from zero to about eleven percent of rows, which is the honest number. Eleven percent of those invoices genuinely do not state the year, and a person now spends four minutes a month resolving them.",
        ],
        code: {
          lang: "text",
          text: `Date rules:
- Only return a year if it appears in the document.
- If the year is absent, return null and add "year_missing" to flags.
- Never infer the year from today's date or from context.
- Always include the raw date string exactly as written.

DOCUMENT DATE: {{doc_date}}`,
        },
      },
    ],
    blocks: [
      { type: "text", text: "Reproduced across three assistants on the same 300-document batch. All three inferred rather than refusing; two of them were inconsistent within a single run.", preview: true },
      { type: "code", text: "on_missing_year: null + flag\npass_document_date: true\nkeep_raw_string: true\nreview_threshold: 90 days" },
    ],
  },

  // ────────────────────────── DISCUSSIONS (5) ──────────────────────────
  {
    key: "trust-question",
    title: "What would it take for you to stop checking the output?",
    post_type: "blog",
    content_type: "Open Question",
    difficulty: "Any",
    ai_tools: ["Any Tool"],
    topics: ["Business", "Learning"],
    use_cases: ["Business", "Other"],
    custom_tags: ["discussion", "trust", "practice"],
    desc:
      "Everyone says they check every output. Almost nobody does after month three. What is your actual threshold, honestly?",
    author: 3,
    daysAgo: 6,
    monetisation: "free",
    cover: COVERS[2],
    metrics: { views: 8900, downloads: 0, rating: 4.4, ratings: 47 },
    sections: [
      {
        h: "The gap between what we say and what we do",
        p: [
          "Ask anyone running an AI setup in production whether a human reviews the output and the answer is yes. Watch them for a fortnight and the answer is that a human glances at the output, which is not the same thing, and after a few weeks of it being consistently fine the glance gets shorter.",
          "This is not a character failure, it is how people work with any reliable tool. Nobody reads every line of a spreadsheet formula's output either. The question worth arguing about is where the honest line sits, not whether we should pretend to hold a line nobody holds.",
        ],
      },
      {
        h: "Three positions I have heard",
        p: [
          "The first: check everything that leaves the building, never check internal drafts. Clean, defensible, and it puts the burden exactly where the consequences are.",
          "The second: check by category rather than by destination. Anything with a number in it gets checked; prose does not. This tracks the actual failure modes better, since fabricated numbers are the expensive failure and slightly flat prose is not.",
          "The third, which I find more honest than it first sounds: check nothing routinely, but keep a weekly audit of twenty random outputs and treat a bad audit as an incident. Sampling rather than inspection, which is how every other high-volume process in the world works.",
        ],
        bullets: [
          "By destination: check what leaves, ignore what stays.",
          "By content: check numbers and claims, not prose.",
          "By sampling: audit twenty a week, treat failures as incidents.",
        ],
      },
      {
        h: "My question",
        p: [
          "What is your real threshold? Not the policy you would state in a meeting — the thing you actually do on a busy Thursday. And what would have to be true for you to move that line further?",
          "I am particularly interested from people in regulated work, where the stated answer is obviously 'check everything' and I suspect the practice is more nuanced than anyone will say publicly.",
        ],
        quote: "A policy nobody follows is worse than a lower standard everybody actually holds.",
      },
    ],
    blocks: [
      { type: "text", text: "Genuinely asking, not building up to a point. I have changed my own position twice this year and would like to hear from people who have landed somewhere different.", preview: true },
    ],
  },
  {
    key: "plain-english",
    title: "The jargon is doing more damage than the technology",
    post_type: "blog",
    content_type: "Blog",
    difficulty: "Any",
    ai_tools: ["Any Tool"],
    topics: ["Learning", "Content"],
    use_cases: ["Learning", "Content"],
    custom_tags: ["discussion", "language", "accessibility"],
    desc:
      "Watching a competent operations manager decide AI was not for her because she hit four undefined terms in one paragraph. That is a writing problem, not a capability problem.",
    author: 2,
    daysAgo: 10,
    monetisation: "free",
    cover: COVERS[3],
    metrics: { views: 14200, downloads: 0, rating: 4.7, ratings: 186 },
    sections: [
      {
        h: "What I watched happen",
        p: [
          "A friend who runs operations for a forty-person company — genuinely good at systems, has built things in spreadsheets I could not — tried to set up a document search tool. She got four paragraphs in, hit four terms she did not know, and closed the tab. Her conclusion was that this was not for people like her.",
          "It absolutely is for people like her. She is exactly the person who should be building these things, because she knows where the time goes. What defeated her was the writing, and the writing is the easiest part to fix.",
        ],
      },
      {
        h: "The substitutions cost nothing",
        p: [
          "Every piece of jargon in this space has a plain replacement that is no longer and no less precise. \"Ready-made setup\" instead of the technical term. \"Connect your apps\" instead of the integration vocabulary. \"Instructions you give it\" instead of the insider phrasing.",
          "The objection is that precision is lost. In my experience precision is gained, because the jargon term is doing a lot of hiding. When you have to write what the thing does in ordinary words, you find out whether you understood it.",
        ],
        bullets: [
          "Every term has a plain replacement of similar length.",
          "Writing plainly reveals whether you understood the thing.",
          "The audience you lose to jargon is the audience with the best problems to solve.",
          "Insider vocabulary is a status signal far more often than a precision tool.",
        ],
      },
      {
        h: "The counter-argument, taken seriously",
        p: [
          "The strongest objection is that plain language slows down conversation between people who already share the vocabulary. That is true and it matters — a team of specialists writing for each other should use their terms.",
          "But almost nothing published publicly is that. Most of it is written for an audience that includes newcomers, by people using the vocabulary to establish that they belong. Those two things get confused constantly.",
        ],
        quote: "If you cannot explain your setup to a competent person outside the field, you have a writing problem, not an audience problem.",
      },
      {
        h: "What I would like to see",
        p: [
          "A simple habit: after writing anything, reread it as the operations manager. Every term she would have to look up, either replace it or define it inline in six words. It adds perhaps five minutes and roughly doubles who can use what you wrote.",
          "I am aware this post is itself a piece of writing advice from someone with obvious opinions. Tell me where I am wrong — particularly if you think the precision loss is real and I am underrating it.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Worth saying: I got this wrong for two years and wrote a lot of impenetrable posts. This is a note to my past self as much as anything.", preview: true },
    ],
  },
  {
    key: "cheap-challenge",
    title: "Challenge: a genuinely useful setup for under £3 a month",
    post_type: "blog",
    content_type: "Challenge",
    difficulty: "Intermediate",
    ai_tools: ["Any Tool"],
    topics: ["Hobby", "Learning"],
    use_cases: ["Hobby", "Learning"],
    custom_tags: ["challenge", "cost", "community"],
    desc:
      "Build something you would miss if it stopped working, for the price of a coffee per month. Post your setup and your actual bill.",
    author: 5,
    daysAgo: 13,
    monetisation: "free",
    cover: COVERS[4],
    metrics: { views: 7100, downloads: 0, rating: 4.5, ratings: 63 },
    sections: [
      {
        h: "The rules",
        p: [
          "Under three pounds a month in running costs, measured over four weeks of real use. Free tiers count only if you would still be within them at your actual usage — no counting on a trial. Hardware you already own is free; hardware you buy for this counts at a twelfth of its price per month.",
          "The setup has to be something you would actually miss. That is the hard constraint. It is easy to build something cheap and pointless, and the point of this is to find out how much real utility is available at the bottom of the market.",
        ],
        bullets: [
          "Under £3/month, measured over four real weeks.",
          "Must be something you would notice stopping.",
          "Post the setup, the bill, and one honest limitation.",
          "Remixes of other entries encouraged — credit is automatic.",
        ],
      },
      {
        h: "My entry",
        p: [
          "A weekly digest that reads six industry newsletters I never open, extracts anything mentioning three specific companies, and sends me forty lines on a Sunday. Running cost last month: £1.12. I would genuinely miss it, which surprised me, because I built it as a throwaway.",
          "The limitation: it misses things phrased indirectly. A newsletter discussing \"the Seattle retailer\" without naming them gets skipped, and I only know that because I read one manually and found something it had passed over.",
        ],
      },
      {
        h: "Why this is worth doing",
        p: [
          "Most of what gets published assumes a budget. The interesting engineering happens under constraint, and there is a whole category of useful, boring, personal setups that never get written up because they are not impressive.",
          "I would rather read thirty of those than one more expensive research stack. Post yours, including the ones that ended up costing more than you expected — those are informative too.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Entries in the comments or as remixes of this post. I will collect the good ones into a shared collection at the end of the month.", preview: true },
    ],
  },
  {
    key: "attribution-norms",
    title: "When you remix someone's setup, what do you owe them?",
    post_type: "blog",
    content_type: "Open Question",
    difficulty: "Any",
    ai_tools: ["Any Tool"],
    topics: ["Business", "Content"],
    use_cases: ["Business", "Content"],
    custom_tags: ["discussion", "credit", "community"],
    desc:
      "Automatic credit links handle the mechanics. The social question is harder: at what point is a remix your own work?",
    author: 0,
    daysAgo: 17,
    monetisation: "free",
    cover: COVERS[5],
    metrics: { views: 5480, downloads: 0, rating: 4.3, ratings: 41 },
    sections: [
      {
        h: "The easy part is solved",
        p: [
          "Remixing carries a credit link automatically, so nobody can accidentally pass off someone else's structure as their own. That handles the mechanical question and it handles it well.",
          "What it does not handle is the judgement call. If I take your instruction, change forty percent of it, add two steps and test it on a completely different kind of document, is that your work with my edits, or my work with your ancestry?",
        ],
      },
      {
        h: "Three positions",
        p: [
          "Strict: the credit link is enough, no further obligation, ever. This is clean and it is how open source largely works. The counter is that a link is invisible next to a post that gets ten times the attention of its source.",
          "Generous: name the original in your own words in the first paragraph, especially if it is doing most of the work. Costs one sentence, and it is what most people would want done for them.",
          "Collaborative: for substantial remixes, offer the original author a revenue split. Some people find this excessive. I have done it twice and both times the resulting conversation improved the setup more than the money mattered.",
        ],
        bullets: [
          "Strict — the automatic link discharges the obligation.",
          "Generous — name them in prose, not just in metadata.",
          "Collaborative — offer a split when the remix is commercial and derivative.",
        ],
      },
      {
        h: "Where I have landed, provisionally",
        p: [
          "If the original's core idea is still the thing that makes my version work, I name them in the text and I do not charge for it. If I have replaced the core and kept only the shape, I treat it as mine and let the link do its job.",
          "That line is fuzzy and I have got it wrong at least once, in the direction of under-crediting something that was more borrowed than I wanted to admit. Interested in how other people draw it, especially anyone who has been on the receiving end of a remix that felt like a lift.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "No right answer being argued for here. I would like this thread to become the thing we point new people at when the question comes up.", preview: true },
    ],
  },
  {
    key: "learning-order",
    title: "The order I would learn this in, if I were starting again",
    post_type: "blog",
    content_type: "Blog",
    difficulty: "Beginner",
    ai_tools: ["ChatGPT", "Claude"],
    topics: ["Learning"],
    use_cases: ["Learning", "Productivity"],
    custom_tags: ["discussion", "learning", "beginner"],
    desc:
      "Two years of doing it in the wrong order, compressed into a sequence that would have saved most of it. Mostly about what to skip.",
    author: 6,
    daysAgo: 27,
    monetisation: "donation",
    cover: COVERS[6],
    metrics: { views: 16800, downloads: 0, rating: 4.8, ratings: 212 },
    sections: [
      {
        h: "What I did wrong",
        p: [
          "I started with the interesting parts — multi-step setups, tool connections, the whole architecture — before I could reliably get a single good answer out of a single request. Everything I built was elaborate scaffolding around a weak core, and when it produced bad output I could not tell which of six moving parts was responsible.",
          "The right order is unglamorous and it is basically: get very good at one request, then two, then connect things. Most people, including me, want to skip to step three because it is the part that looks like engineering.",
        ],
      },
      {
        h: "The sequence",
        p: [
          "Week one, one request at a time. Take a real task you do weekly and get the assistant to do it well in a single message. Learn what examples do, learn what a refusal clause does, learn to tell whether the output is actually good. This is the whole foundation and it is boring.",
          "Weeks two and three, add checking. Learn the two-pass idea, build a twenty-input scoring set, get a number for how good your one request actually is. Now you can tell whether a change helped, which you could not before, and which is the skill everything else rests on.",
          "Week four onwards, connect things. Only now. With a reliable single step and a way to measure it, chaining steps is straightforward and debuggable, because you can measure each link separately.",
        ],
        bullets: [
          "Week 1 — one request, done well. Examples over instructions.",
          "Week 2-3 — checking and measurement. Get a number.",
          "Week 4+ — connect steps, measuring each one.",
          "Skip entirely at the start: local models, fine-tuning, agent frameworks.",
        ],
      },
      {
        h: "What to skip",
        p: [
          "Fine-tuning. Almost nobody needs it and the people who do know they do. Local models, until you have a confidentiality reason. Any framework whose tutorial takes longer than the thing you are building would take by hand.",
          "Also skip the discourse. There is a large volume of argument about capability and trajectory that is genuinely interesting and has no bearing whatsoever on whether your invoice extraction works. Read it for pleasure, not for instruction.",
        ],
        quote: "Get one request excellent before you build anything that has two.",
      },
      {
        h: "The bit nobody says",
        p: [
          "Most of the skill is in judging output quality, not in producing it. That is a taste question, learned by looking at a lot of output next to a clear idea of what good looks like for your specific job. It does not transfer between domains — I am good at judging research briefs and useless at judging generated code.",
          "Which means the fastest way to get good at this in your field is to already be good at your field. That is genuinely encouraging news for the operations managers and finance people and teachers who assume they are behind.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "Donation-enabled rather than paid. If it saves you a month of wrong turns, that felt like the right shape.", preview: true },
    ],
  },

  // ────────────────────────── BOUNTIES (3) ──────────────────────────
  {
    key: "bounty-handwriting",
    title: "Bounty: reliable extraction from handwritten delivery notes",
    post_type: "bounty",
    content_type: "Agent Blueprint",
    difficulty: "Advanced",
    ai_tools: ["Any Tool"],
    topics: ["Business", "Productivity"],
    use_cases: ["Business", "Productivity"],
    custom_tags: ["bounty", "extraction", "handwriting"],
    desc:
      "Photographs of handwritten delivery notes into structured rows, at 90% field accuracy or better. £400 for a setup that hits it on my test set.",
    author: 4,
    daysAgo: 4,
    monetisation: "free",
    cover: COVERS[7],
    metrics: { views: 6900, downloads: 0, rating: 0, ratings: 0 },
    bounty: { reward_type: "cash", amount: 400, status: "open" },
    sections: [
      {
        h: "The problem",
        p: [
          "We receive roughly 200 handwritten delivery notes a week, photographed on phones by drivers in varying light. Each has a date, a supplier, between one and twelve line items with quantities, and a signature block. Currently two people spend a day and a half a week typing them in.",
          "Everything I have tried gets the printed header fields right and falls apart on the handwritten line items, particularly quantities, where a 7 and a 1 are frequently indistinguishable even to a person.",
        ],
      },
      {
        h: "What winning looks like",
        p: [
          "90% field-level accuracy across a 100-note test set I will provide, with the crucial condition that low-confidence fields are flagged rather than guessed. A setup that gets 85% and flags every uncertain field beats one that gets 92% silently — I need to know which rows to check.",
          "It must run on tooling a small business can actually operate. Nothing requiring a machine learning engineer to maintain, nothing with a five-figure annual floor.",
        ],
        bullets: [
          "90% field accuracy on the provided 100-note test set.",
          "Every uncertain field flagged, not guessed.",
          "Runs on commonly available tools, maintainable by a non-specialist.",
          "Handles poor lighting and angled photographs.",
        ],
      },
      {
        h: "What I will provide",
        p: [
          "A hundred real notes with hand-verified ground truth, anonymised. Twenty of them up front for development; the remaining eighty held back for scoring, which I will run myself and publish in full regardless of the result.",
          "Ask questions in the comments. If your approach is close but misses the bar I will say so publicly and honestly rather than quietly declining.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "£400, paid on a verified score against the held-back set. Happy to split across two entries if two approaches combine to beat either alone.", preview: true },
      { type: "code", text: "test_set: 100 notes (20 dev / 80 held back)\ntarget: 90% field accuracy\nrequired: confidence flagging\nreward: £400" },
    ],
  },
  {
    key: "bounty-accessibility",
    title: "Bounty: plain-English rewriter that keeps legal meaning intact",
    post_type: "bounty",
    content_type: "Prompt File",
    difficulty: "Advanced",
    ai_tools: ["Claude", "ChatGPT"],
    topics: ["Content", "Learning"],
    use_cases: ["Content", "Learning"],
    custom_tags: ["bounty", "accessibility", "language"],
    desc:
      "Rewrite tenancy documents at a reading age of 12 without changing a single obligation. £250, judged by two housing advisers.",
    author: 2,
    daysAgo: 8,
    monetisation: "free",
    cover: COVERS[8],
    metrics: { views: 4300, downloads: 0, rating: 0, ratings: 0 },
    bounty: { reward_type: "cash", amount: 250, status: "open" },
    sections: [
      {
        h: "Why this is hard",
        p: [
          "Simplifying legal text is easy if you are allowed to lose precision, and useless if you do. \"You must not sublet without written permission\" and \"you cannot let anyone else live here\" are not the same sentence, and the difference is somebody's housing.",
          "Every attempt I have seen either produces something still unreadable or quietly drops a condition. The hard requirement is meaning preservation, measured by people who do this professionally.",
        ],
      },
      {
        h: "The judging",
        p: [
          "Two housing advisers will read ten rewritten clauses against the originals and answer one question per clause: does this change what the tenant must or must not do, in any respect? Any single yes disqualifies the entry.",
          "Passing entries are then scored for readability. Highest readability among the entries that preserve meaning perfectly takes the £250.",
        ],
        bullets: [
          "Ten clauses, judged by two housing advisers independently.",
          "Any meaning change on any clause disqualifies the entry.",
          "Among perfect entries, highest readability wins.",
          "Output must flag anything it could not simplify safely.",
        ],
      },
      {
        h: "A hint from my failed attempts",
        p: [
          "Everything I tried that asked for simplification directly lost conditions. The approach that got closest listed every obligation as a separate item first, rewrote each in isolation, then reassembled — meaning was preserved but the prose was stilted and scored badly on readability.",
          "I suspect the answer is a checking pass that compares obligation lists between original and rewrite. I have not made it work; the £250 is because I would rather pay than keep failing at it.",
        ],
      },
    ],
    blocks: [
      { type: "text", text: "The winning entry gets published free on this site with the author credited. That is a condition of entry — this should not sit behind a paywall.", preview: true },
      { type: "code", text: "clauses: 10\njudges: 2 housing advisers\ndisqualify_on: any meaning change\nwin_on: readability\nreward: £250" },
    ],
  },
  {
    key: "bounty-meta-onboarding",
    title: "Meta-bounty: a complete starter kit for a small charity",
    post_type: "bounty",
    content_type: "Agent Stack",
    difficulty: "Intermediate",
    ai_tools: ["Any Tool"],
    topics: ["Business", "Productivity"],
    use_cases: ["Business", "Productivity"],
    custom_tags: ["bounty", "meta", "charity"],
    desc:
      "Five separate pieces, funded together, that give a ten-person charity a working set of AI helpers in one afternoon. Pledges open on each piece.",
    author: 0,
    daysAgo: 12,
    monetisation: "free",
    cover: COVERS[9],
    metrics: { views: 5100, downloads: 0, rating: 0, ratings: 0 },
    bounty: {
      reward_type: "cash",
      amount: 1200,
      status: "open",
      is_meta: true,
      subs: [
        {
          title: "Grant application drafter",
          description:
            "Takes the charity's standard information plus a specific funder's criteria and produces a first draft that addresses each criterion explicitly, flagging anything it does not have information for.",
          target: 300,
        },
        {
          title: "Donor thank-you writer",
          description:
            "Writes individual thank-you notes from a donation record, matching the charity's voice, never inventing detail about what the donation funded.",
          target: 200,
        },
        {
          title: "Volunteer rota assistant",
          description:
            "Reads availability replies in free text — email, WhatsApp, however they arrive — and produces a clean availability grid with conflicts flagged.",
          target: 250,
        },
        {
          title: "Impact report assembler",
          description:
            "Turns a quarter of activity records into a two-page report with every figure traceable to a source record, and gaps marked rather than smoothed over.",
          target: 300,
        },
        {
          title: "Plain-English policy rewriter",
          description:
            "Rewrites internal policies so a new volunteer can follow them, preserving every actual requirement.",
          target: 150,
        },
      ],
    },
    sections: [
      {
        h: "Why fund it as one thing",
        p: [
          "Small charities do not lack ideas about where AI could help; they lack anyone with a spare afternoon to build it. Five separate small setups, each individually unremarkable, together cover most of the administrative load that eats a ten-person organisation.",
          "Funding them as a group means they get designed to fit together — same conventions, same tone handling, same approach to flagging uncertainty — rather than five unrelated things a volunteer has to reconcile.",
        ],
      },
      {
        h: "How the pledging works",
        p: [
          "Each piece has its own target. When a piece reaches its target, it opens as an individual bounty and anyone can submit. Pieces are independent — if only three of five fund, three get built and the other two stay open.",
          "I have put in the first £200 across the five. Everything built here is published free with the authors credited, and I will personally deploy the finished set with two charities I already work with and write up how it went, including the parts that fail.",
        ],
        bullets: [
          "Five pieces, £1,200 total, each independently funded.",
          "A piece opens as a bounty when it hits its own target.",
          "All output published free, authors credited.",
          "Real deployment with two charities, written up honestly.",
        ],
      },
      {
        h: "Design conventions all five must follow",
        p: [
          "Every piece flags rather than guesses. Every piece is operable by someone who has never written an instruction before. Every piece includes its own twenty-input scoring set so the charity can tell if it stops working.",
          "That last one is unusual to require and it is the difference between a gift and a liability. Handing a small organisation something clever they cannot evaluate is not help.",
        ],
        quote: "A setup a charity cannot evaluate is a liability with good intentions attached.",
      },
    ],
    blocks: [
      { type: "text", text: "Pledges are per-piece. Nothing is charged until a piece hits its target and a submission is accepted.", preview: true },
      { type: "code", text: "pieces: 5\ntotal: £1200\nfunding: per_piece\nspawn_at: 100% of piece target\noutput: free, credited" },
    ],
  },
];
