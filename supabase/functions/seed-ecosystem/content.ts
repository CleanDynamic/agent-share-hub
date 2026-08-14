// ─────────────────────────────────────────────────────────────
// Ecosystem seed content library.
// Pure data + prose scaffolding. No Supabase access in this file.
// ─────────────────────────────────────────────────────────────

export const DEMO_EMAIL_DOMAIN = "ecosystem.demo";

export interface CreatorSpec {
  username: string;
  display_name: string;
  bio: string;
  location: string;
  website_url?: string;
  twitter_handle?: string;
  account_type: string;
  is_creator: boolean;
  is_curator?: boolean;
  interests: string[];
  tools: string[];
  xp: number;
  level: number;
  streak: number;
  service?: { title: string; description: string; price_gbp: number };
}

export const CREATORS: CreatorSpec[] = [
  {
    username: "mara_okafor",
    display_name: "Mara Okafor",
    bio: "I build ready-made AI setups for research teams. Ten years in information retrieval, three years shipping AI assistants that people actually keep using.",
    location: "Lagos, Nigeria",
    website_url: "https://example.com/mara",
    twitter_handle: "maraokafor",
    account_type: "creator",
    is_creator: true,
    is_curator: true,
    interests: ["Research", "Business", "Productivity"],
    tools: ["ChatGPT", "Claude", "n8n"],
    xp: 8420,
    level: 12,
    streak: 23,
    service: {
      title: "Retrieval setup review (90 min)",
      description:
        "I go through your document search setup end to end, find where answers go missing, and leave you with a written fix list ordered by effort.",
      price_gbp: 240,
    },
  },
  {
    username: "devesh_rao",
    display_name: "Devesh Rao",
    bio: "Automation plumber. I connect the boring apps so the clever bits have somewhere to run. Mostly Make, n8n and a lot of patience.",
    location: "Bengaluru, India",
    twitter_handle: "deveshbuilds",
    account_type: "creator",
    is_creator: true,
    interests: ["Productivity", "Business", "Email"],
    tools: ["Make", "n8n", "Zapier", "ChatGPT"],
    xp: 6110,
    level: 10,
    streak: 9,
    service: {
      title: "One automation, built with you",
      description:
        "We pick one repetitive job in your week and build the automation together on a shared call. You keep the working setup and the notes.",
      price_gbp: 180,
    },
  },
  {
    username: "june_halliday",
    display_name: "June Halliday",
    bio: "Writer turned prompt tinkerer. I care about whether the output is any good, not whether the setup looks clever.",
    location: "Glasgow, Scotland",
    account_type: "creator",
    is_creator: true,
    interests: ["Content", "Learning", "Hobby"],
    tools: ["Claude", "ChatGPT", "Gemini"],
    xp: 4980,
    level: 9,
    streak: 41,
  },
  {
    username: "tomas_lindqvist",
    display_name: "Tomas Lindqvist",
    bio: "I test things until they break, then write down exactly how they broke. Failure notes are underrated.",
    location: "Malmö, Sweden",
    account_type: "creator",
    is_creator: true,
    is_curator: true,
    interests: ["Research", "Learning", "Other"],
    tools: ["ChatGPT", "Claude", "Grok"],
    xp: 7250,
    level: 11,
    streak: 5,
  },
  {
    username: "priya_menon",
    display_name: "Priya Menon",
    bio: "Finance ops by day. I build small AI helpers that keep month-end from eating my weekend.",
    location: "Singapore",
    account_type: "creator",
    is_creator: true,
    interests: ["Finance", "Business", "Productivity"],
    tools: ["ChatGPT", "Zapier"],
    xp: 3140,
    level: 7,
    streak: 12,
  },
  {
    username: "otis_bell",
    display_name: "Otis Bell",
    bio: "Solo founder. Everything I publish here is something I use in my own business first, warts included.",
    location: "Austin, TX",
    website_url: "https://example.com/otis",
    account_type: "creator",
    is_creator: true,
    interests: ["Business", "Social Media", "Email"],
    tools: ["ChatGPT", "Make"],
    xp: 2260,
    level: 6,
    streak: 3,
  },
  {
    username: "lena_fischer",
    display_name: "Lena Fischer",
    bio: "Teacher. I translate AI setups into things a classroom can survive on a Monday morning.",
    location: "Leipzig, Germany",
    account_type: "user",
    is_creator: false,
    interests: ["Learning", "Content", "Productivity"],
    tools: ["ChatGPT", "Gemini"],
    xp: 890,
    level: 4,
    streak: 7,
  },
  {
    username: "sam_ndlovu",
    display_name: "Sam Ndlovu",
    bio: "Reads more than posts. Mostly here for the failure library and the arguments.",
    location: "Cape Town, South Africa",
    account_type: "user",
    is_creator: false,
    interests: ["Hobby", "Learning", "Research"],
    tools: ["ChatGPT"],
    xp: 310,
    level: 2,
    streak: 2,
  },
];

export interface Section {
  h: string;
  p: string[];
  bullets?: string[];
  code?: { lang: string; text: string };
  quote?: string;
}

export interface BlockSpec {
  type: "text" | "code" | "long_text" | "image" | "file";
  text: string;
  instructions?: string;
  preview?: boolean;
}

export interface PostSpec {
  key: string;
  title: string;
  post_type: "blueprint" | "blog" | "bounty";
  content_type: string;
  difficulty: string;
  ai_tools: string[];
  topics: string[];
  use_cases: string[];
  custom_tags: string[];
  desc: string;
  author: number;
  daysAgo: number;
  monetisation: "free" | "paid" | "donation" | "pwyw" | "subscription";
  price?: number;
  cover?: string;
  sections: Section[];
  blocks: BlockSpec[];
  results?: Array<{
    kind: "written" | "photo" | "video";
    text?: string;
    url?: string;
    caption?: string;
  }>;
  stageGrid?: { name: string; blocks: Array<{ type: string; name: string }> };
  metrics: { views: number; downloads: number; rating: number; ratings: number };
  bounty?: {
    reward_type: "cash" | "kudos" | "none";
    amount?: number;
    status: "open" | "solved";
    is_meta?: boolean;
    subs?: Array<{ title: string; description: string; target: number }>;
  };
}

const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

export const COVERS = [
  IMG("1518770660439-4636190af475"),
  IMG("1526374965328-7f61d4dc18c5"),
  IMG("1451187580459-43490279c0fa"),
  IMG("1487058792275-0ad4aaf24ca7"),
  IMG("1555949963-aa79dcee981c"),
  IMG("1517180102446-f3ece451e9d8"),
  IMG("1497032628192-86f99bcd76bc"),
  IMG("1531297484001-80022131f5a1"),
  IMG("1504384308090-c894fdcc538d"),
  IMG("1460925895917-afdab827c52f"),
];

/**
 * Shared prose scaffolding. Every post gets a consistent spine of sections
 * so the seeded feed reads like a real, house-style content ecosystem.
 */
export function scaffoldSections(spec: PostSpec): Section[] {
  const tools = spec.ai_tools.join(", ");
  const primary = spec.ai_tools[0] ?? "your AI assistant";
  const topic = spec.topics[0] ?? "AI work";

  const before: Section[] = [
    {
      h: "Before you start",
      p: [
        `This write-up assumes you already have access to ${tools} and nothing else. There is no server to rent, no repository to clone and no billing account to set up beyond whatever plan you already pay for. If a step needs something extra it says so in the step itself, in plain terms, with the cheapest option listed first.`,
        `I have written it for someone at a ${spec.difficulty.toLowerCase()} comfort level. If you are further along, skim the numbered part and read the failure notes — that is where the useful detail lives. If this is your first serious attempt at ${topic.toLowerCase()}, work through it in order and resist the urge to change three things at once.`,
      ],
      bullets: [
        `Time to first working version: about 25 minutes of hands-on work.`,
        `Ongoing cost: whatever ${primary} already costs you, plus nothing.`,
        `What you keep at the end: a setup you can hand to a colleague without explaining it live.`,
      ],
    },
  ];

  const after: Section[] = [
    {
      h: "Where this goes wrong",
      p: [
        `The failure I see most often is people judging the setup on its first answer. First answers are unrepresentative — they are usually either suspiciously good or obviously broken, and neither tells you much. Run it against ten real inputs from your own week before you decide anything.`,
        `The second failure is silent truncation. When you hand ${primary} more material than it can hold, it does not usually complain. It quietly works with what fits and writes something confident about the part it saw. If an answer feels thin in a way you cannot explain, check the size of what you sent before you rewrite the instructions.`,
        `The third is drift. A setup that worked in March can behave differently in June because the underlying assistant changed underneath you, not because you touched anything. Keep a small file of three inputs and their known-good outputs, and re-run it monthly. It takes two minutes and saves you a bad afternoon.`,
      ],
      bullets: [
        "Empty or near-empty input produces confident nonsense — filter for length before sending.",
        "Long inputs get quietly trimmed — split them and combine the answers instead.",
        "Answers that name sources are easier to trust than answers that sound certain.",
      ],
    },
    {
      h: "How to tell it is actually working",
      p: [
        `Pick a measure before you start, otherwise you will grade on vibes. For this setup I use a straightforward one: out of twenty real inputs, how many answers could I forward to the person who asked without editing them? Under twelve and something is structurally wrong. Between twelve and seventeen and you are in normal territory, which is to say useful but supervised. Above seventeen and you can start trusting it with work that leaves your desk.`,
        `Write the score down with the date. The point is not the number, it is having something to compare against after you change a step. Most people skip this and then cannot tell whether their tweak helped or hurt.`,
      ],
    },
    {
      h: "Making it yours",
      p: [
        `Everything here is a starting position, not a recipe to follow exactly. The parts worth changing first are the wording of your instructions and the examples you include — those move quality far more than swapping which assistant you use. Change one, test on the same twenty inputs, keep it if the score goes up.`,
        `If you build something better on top of this, publish it. Credit is automatic when you remix, and honestly the version that survives contact with someone else's messy real data is always the more useful one.`,
      ],
    },
  ];

  return [...before, ...spec.sections, ...after];
}

/** Convert sections into TipTap document JSON. */
export function toArticleBody(sections: Section[], stageGridId?: string) {
  const content: unknown[] = [];
  if (stageGridId) {
    content.push({
      type: "stageGrid",
      attrs: {
        height: 360,
        stageId: stageGridId,
        stageTitle: "",
        gridSpacing: 20,
        openTemplatesOnMount: false,
      },
    });
  }
  for (const s of sections) {
    content.push({
      type: "heading",
      attrs: { level: 2, textAlign: null },
      content: [{ type: "text", text: s.h }],
    });
    for (const para of s.p) {
      content.push({
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text: para }],
      });
    }
    if (s.bullets?.length) {
      content.push({
        type: "bulletList",
        content: s.bullets.map((b) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              attrs: { textAlign: null },
              content: [{ type: "text", text: b }],
            },
          ],
        })),
      });
    }
    if (s.quote) {
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [{ type: "text", text: s.quote }],
          },
        ],
      });
    }
    if (s.code) {
      content.push({
        type: "codeBlock",
        attrs: { language: s.code.lang },
        content: [{ type: "text", text: s.code.text }],
      });
    }
  }
  return { type: "doc", content };
}

export function wordCount(sections: Section[]): number {
  let n = 0;
  for (const s of sections) {
    n += s.h.split(/\s+/).length;
    for (const p of s.p) n += p.split(/\s+/).length;
    for (const b of s.bullets ?? []) n += b.split(/\s+/).length;
    if (s.quote) n += s.quote.split(/\s+/).length;
    if (s.code) n += s.code.text.split(/\s+/).length;
  }
  return n;
}
