/* CA-16 P1: the classification lists, in one versioned module.

   HOW TO ADD A VALUE. Each list below is a block of indented text, one value per line. Indent two spaces to put a value
   under the one above it. After the label, ` | ` starts its synonyms (the terms people actually type, comma separated,
   one to five). `#slug` after the label sets its id segment where the label is too long to be a good one. In the Field
   list `=> A; B` after the label makes the value an entry point: a search for it also offers the values named. An id is
   the parent's id, a dot, and the slug, so `ai-ml.retrieval.hybrid-search` sits under `ai-ml.retrieval`. When the lists
   grow, raise TAXONOMY_VERSION by one: a build records the version its classification was made with.

   Product names never appear in the Field list; they live in Tools and stack. */

import { TOOLS, type Tool } from "@/lib/tools/registry";

export const TAXONOMY_VERSION = 1;

export type Facet =
  | "field"
  | "task"
  | "setting"
  | "built"
  | "role"
  | "technique"
  | "modality"
  | "method"
  | "autonomy"
  | "stack"
  | "data"
  | "oversight"
  | "age"
  | "skill"
  | "cost";

export interface TaxonomyValue {
  /** A lowercase dotted slug, unique within its facet. */
  id: string;
  label: string;
  facet: Facet;
  parent: string | null;
  /** One to five terms people type for it. */
  synonyms: string[];
  /** Depth under its facet's roots; 0 for a root. */
  depth: number;
  /** A heading (a group in Task, Setting and Tools and stack) is never chosen itself. */
  selectable: boolean;
  /** Field only: the ids a search for this value also offers. */
  pointsTo: string[];
  /** Field only: "general" (Area › Field) or "technical" (Domain › Subdomain › Niche). */
  branch?: "general" | "technical";
}

export const FACET_LABEL: Record<Facet, string> = {
  field: "Field",
  task: "Task",
  setting: "Setting",
  built: "What was built",
  role: "Role of AI",
  technique: "Techniques",
  modality: "Modality",
  method: "Build method",
  autonomy: "Autonomy",
  stack: "Tools and stack",
  data: "Data handled",
  oversight: "Human oversight",
  age: "Age suitability",
  skill: "Skill needed",
  cost: "Cost to run",
};

export const slugOf = (label: string): string =>
  label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

interface ParseOptions {
  /** Whether a line with children is a heading that cannot be chosen. */
  headings: boolean;
  branch?: (rootId: string) => "general" | "technical";
}

/** Entry-point targets by label, resolved once every Field block is read (a target can sit in the other branch). */
const PENDING_TARGETS = new Map<TaxonomyValue, string[]>();

/** Reads one block of indented text into values. */
function parse(facet: Facet, block: string, options: ParseOptions): TaxonomyValue[] {
  const out: TaxonomyValue[] = [];
  const stack: TaxonomyValue[] = [];
  const entries: { value: TaxonomyValue; targets: string[] }[] = [];
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  const indentOf = (line: string) => (line.length - line.trimStart().length) / 2;

  lines.forEach((line, index) => {
    const depth = indentOf(line);
    let body = line.trim();
    let synonyms: string[] = [];
    const bar = body.indexOf(" | ");
    if (bar >= 0) {
      synonyms = body
        .slice(bar + 3)
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean);
      body = body.slice(0, bar).trim();
    }
    let targets: string[] = [];
    const arrow = body.indexOf(" => ");
    if (arrow >= 0) {
      targets = body
        .slice(arrow + 4)
        .split(";")
        .map((word) => word.trim())
        .filter(Boolean);
      body = body.slice(0, arrow).trim();
    }
    let slug = "";
    const hash = body.indexOf(" #");
    if (hash >= 0) {
      slug = body.slice(hash + 2).trim();
      body = body.slice(0, hash).trim();
    }
    stack.length = depth;
    const parent = depth > 0 ? stack[depth - 1] : null;
    const next = lines[index + 1];
    const hasChildren = next !== undefined && indentOf(next) > depth;
    const segment = slug || slugOf(body);
    const value: TaxonomyValue = {
      id: parent ? `${parent.id}.${segment}` : segment,
      label: body,
      facet,
      parent: parent ? parent.id : null,
      synonyms,
      depth,
      selectable: !(options.headings && hasChildren),
      pointsTo: [],
      ...(options.branch ? { branch: options.branch(parent ? (stack[0] as TaxonomyValue).id : segment) } : null),
    };
    stack[depth] = value;
    out.push(value);
    if (targets.length > 0) entries.push({ value, targets });
  });

  for (const { value, targets } of entries) PENDING_TARGETS.set(value, targets);
  return out;
}

/* ── Field, general branch (Area › Field › Specialism) ── */

const FIELD_GENERAL = `
Medicine and health #medicine | medical, healthcare, health care
  Clinical practice | clinician, doctor, GP
  Medical research | biomedical, clinical research
    Clinical text mining | clinical NLP, medical records
  Nursing and care | nurse, carer, care home
  Mental health | psychiatry, wellbeing, therapy
  Public health | epidemiology, population health
  Pharmacy and drug discovery | pharma, pharmaceutical, drug development
  Dentistry | dental, dentist
  Veterinary | vet, animal health
  Nutrition | dietetics, diet
  Health administration | NHS management, hospital admin
Life and physical sciences #science | natural sciences, STEM
  Biology and genomics | bioscience, DNA, genetics
  Chemistry | chemical
  Physics | quantum, particle physics
  Earth and climate | geology, climate science, weather
  Astronomy | space, astrophysics
  Environmental science | ecology, conservation
  Materials | materials science, polymers
Mathematics and data #maths-data => Data engineering and analytics; Scientific and research computing; Formal methods and theory | maths, math, statistics, data
Engineering and technology #engineering => AI and machine learning; Software engineering; Data engineering and analytics; Infrastructure and operations; Security; Embedded systems and hardware; Robotics and autonomous systems; Scientific and research computing; Quantitative finance; Blockchain and distributed systems; Networking; Formal methods and theory; Accessibility engineering; Web publishing and content systems | engineer, tech
  Mechanical | mechanical engineering, machines
  Civil and structural | civil engineering, structures, bridges
  Energy | power, renewables, utilities
Social sciences #social | social research
  Sociology | society, social theory
    Quantitative methods | surveys, statistics, regression
  Psychology | behaviour, cognitive
  Economics | economy, econometrics
  Political science | politics, elections
  Anthropology | ethnography
  Human geography | geography, urban studies
  Criminology | crime, policing research
  Social policy | welfare, social work
Humanities | arts and humanities
  History | historical
  Philosophy | ethics
  Religion | theology, religious studies
  Linguistics | language science, grammar
  Literature | novels, poetry, English literature
  Classics | Latin, ancient Greek
  Art history | art theory
  Archaeology | excavation, heritage
Education #education | teaching, school
  Early years | nursery, EYFS, preschool
  Primary teaching | primary school, KS1, KS2
    Lesson planning | lesson plans, schemes of work
  Secondary teaching | secondary school, GCSE, A level
    Assessment | marking, grading, feedback
  Higher education | university, lecturer, college
  Special educational needs | SEN, SEND, inclusion
  Tutoring | tutor, revision
  Language teaching | ESL, EFL, languages
  School administration | school office, timetabling
Law | legal, solicitor, lawyer
  Legal practice | law firm, solicitor
  Contracts | contract drafting, agreements
  Litigation | disputes, court
  Compliance | regulation, regulatory
  Intellectual property | IP, patents, trademarks
  Legal research | case law, legislation
Finance and investing #finance | finance, money, investment
  Trading and investing | trading, stocks, markets
    Algorithmic trading | algo trading, trading bot
  Banking | bank, lending
  Accounting and audit | accountant, bookkeeping, audit
  Insurance | underwriting, claims
  Financial planning | wealth, pensions, financial advice
  Digital assets | crypto, cryptocurrency, bitcoin
  Tax | HMRC, tax returns, VAT
Business operations #business | business, management
  Strategy | planning, consulting
  Operations | ops, process improvement
  Project management | PM, delivery, agile
  Procurement | purchasing, sourcing
  Supply chain | logistics, inventory
  HR and recruitment | HR, hiring, people team
  Customer service | support, helpdesk, customer support
Marketing and sales | marketing, sales
  Content marketing | blogging, copywriting
  Social media | social, Instagram, TikTok
  User-generated content | UGC, reviews
  Advertising | ads, PPC, campaigns
  Search optimisation | SEO, search engine optimisation
  Email marketing | newsletters, email campaigns
  Sales outreach | cold email, prospecting, lead generation
  Brand | branding, identity
Commerce and industry #commerce | trade, industry
  E-commerce | online shop, ecommerce, online store
  Retail | shop, stores
  Property | real estate, estate agent, lettings
  Construction | building, site
  Manufacturing | factory, production
  Agriculture | farming, crops
  Hospitality and tourism | hotel, restaurant, tourism
  Transport | fleet, haulage, freight
  Trades | plumber, electrician, tradesperson
Media and creative arts #media | creative, arts
  Writing and publishing | author, publishing, books
  Journalism | news, reporting
  Film and video | film, video production
  Music and audio | music, podcast
  Photography | photos, photographer
  Visual art | painting, illustration
  Graphic design | design, logos
  Fashion | clothing, style
  Animation and 3D | animation, 3D, Blender
Games and entertainment #games | gaming, entertainment
  Video games | gaming, game design
  Tabletop and role-playing | D&D, RPG, board games
  Interactive fiction | text adventure, choose your own adventure
  Quizzes and puzzles | quiz, trivia, crossword
  Sport | football, fitness league, sports analytics
  Fan communities | fandom, fan fiction
Government and public sector #government | public sector, civil service
  Public services | council services, citizen services
  Policy | policy making, briefings
  Local government | council, local authority
  Emergency services | police, fire, ambulance
Personal life #personal | everyday, life admin
  Productivity | to-do, organisation, planner
  Personal finance | budgeting, savings
  Health and fitness | exercise, workouts, wellbeing
  Food and cooking | recipes, meal planning
  Travel | holiday, itinerary, trip planning
  Home and family | household, parenting
  Learning a skill | self-improvement, study
Hobbies and making #hobbies | hobby, DIY and crafts
  Crafts | knitting, sewing, crafting
  DIY | home improvement, woodworking
  Gardening | garden, plants, allotment
  Pets | dogs, cats, pet care
  Collecting | collection, collectibles
  Motoring | cars, motorbikes
  Outdoors | hiking, camping, walking
Community and causes #community | community, third sector
  Charities | charity, nonprofit, non-profit
  Volunteering | volunteers
  Campaigns | campaigning, activism
  Faith groups | church, mosque, synagogue
  Accessibility and inclusion | disability, inclusive design
  Climate action | sustainability, net zero
`;

/* ── Field, technical branch (Domain › Subdomain › Niche, then an optional Specialism) ── */

const FIELD_TECHNICAL = `
Software engineering #software | programming, coding, development
  Frontend web | front end, UI, web development
    Component libraries | UI components, widgets
    State management | Redux, global state
    Rendering and performance | web performance, SSR
    Forms and validation | form handling
    Design systems | style guide, tokens
  Backend and APIs | back end, server side
    REST and GraphQL APIs | REST, GraphQL, API design
    Authentication and authorisation | auth, login, OAuth
    Background jobs and queues | cron, workers, task queue
    Real-time and websockets | websocket, live updates
    Payments | checkout, billing
  Mobile | iOS and Android, apps
    Native iOS | Swift, iPhone
    Native Android | Kotlin, Android
    Cross-platform | React Native, Flutter
    Offline sync | offline first
    App store release | App Store, Play Store
  Desktop | desktop apps
    Native desktop | Windows app, macOS app
    Cross-platform desktop | Electron, Tauri
  Testing and quality | QA, quality assurance
    Unit and integration testing | unit tests, integration tests
    End-to-end testing | e2e, Playwright, Cypress
    Test generation | generated tests
    Code review | pull request review, PR review
  Developer tooling | dev tools, DX
    Editor extensions | VS Code extension, plugins
    Command-line tools | CLI, terminal tools
    Code generation | codegen, scaffolding
    Documentation generation | docs, auto docs
  Architecture and modernisation | architecture, system design
    Legacy migration | migration, rewrite
    Refactoring | clean up code, tech debt
    Microservices | service architecture
    Monorepos | monorepo, workspaces
  Game development | gamedev, game programming
    Gameplay programming | game mechanics
    Procedural generation | procgen, level generation
    Non-player character dialogue | NPC dialogue, NPC
    Engine tooling | game engine tools
AI and machine learning #ai-ml | AI, ML, artificial intelligence
  Model training #training | training, ML training
    Pre-training | foundation model
    Fine-tuning | finetuning, tuning
    Adapters (LoRA) | LoRA, QLoRA, PEFT
    Distillation | model distillation, knowledge distillation
    Synthetic training data | synthetic data, generated data
  Inference and serving #inference | serving, model serving
    Quantisation | quantization, GGUF, 4-bit
    Batching and caching | prompt caching, KV cache
    On-device models | edge AI, on device
    Self-hosted models | self hosted LLM, local LLM
  Retrieval systems #retrieval | retrieval, RAG, search
    Chunking and embedding | chunking, embeddings
    Vector search | vector database, similarity search
    Hybrid search | BM25, keyword and vector
    Reranking | re-ranking, cross-encoder
    Knowledge graphs | graph RAG, ontology
  Agents and orchestration #agents | agents, agentic
    Tool calling | function calling, tools
    Planning and memory | agent memory, planning
    Multi-agent systems | multi agent, agent teams
    Computer and browser use | computer use, browser agent
    MCP servers | MCP, model context protocol
  Evaluation #evaluation | evals, evaluations
    Model-graded evaluation | LLM as judge, LLM-as-a-judge
    Benchmarks | benchmarking, leaderboards
    Regression testing | prompt regression, eval regression
    Human evaluation | human review, annotation
  LLM operations #llmops | LLMOps, prompt ops
    Prompt management | prompt versioning, prompt registry
    Tracing and observability | tracing, LLM observability
    Cost and latency | token cost, latency
    Model routing | router, model router
  Safety and guardrails #safety | AI safety, guardrails
    Prompt-injection defence | prompt injection, jailbreak defence
    Content filtering | moderation, content moderation
    Red teaming | red team, adversarial testing
  Language (NLP) #nlp | NLP, natural language processing, text analysis
    Text classification | sentiment analysis, classifier
    Entity extraction | NER, named entity recognition
    Summarisation | summarization, summaries
    Machine translation | translation
  Computer vision | CV, vision, image processing
    Image classification | image recognition
    Object detection | YOLO, detection
    Segmentation | image segmentation
    Document AI and OCR | OCR, document understanding
    Image generation | text to image, diffusion
  Speech and audio | speech, voice
    Speech recognition | ASR, speech to text, transcription
    Speech synthesis | TTS, text to speech
    Voice agents | voice bot, voice assistant
    Music generation | AI music
  Recommender systems | recommendation, recommenders
    Ranking | learning to rank
    Personalisation | personalization
  Reinforcement learning | RL
    Learning from human feedback | RLHF, preference tuning
    Game-playing agents | game AI
    Control policies | policy learning
Data engineering and analytics #data | data, analytics, data science
  Pipelines | data pipelines
    ETL and ELT | ETL, ELT, data integration
    Streaming | Kafka, real-time data
    Workflow orchestration | Airflow, DAGs
  Databases | database, DB
    Relational | SQL, relational database
    Document | NoSQL, document store
    Graph | graph database, Neo4j
    Vector | vector store
    Time series | time-series, metrics store
  Analytics engineering | dbt, analytics
    Data modelling | data models, schema design
    Semantic layers | semantic layer, metrics layer
    Natural language to SQL | text to SQL, NL2SQL
  Data quality | data validation
    Validation | data checks
    Deduplication | dedupe, duplicates
    Cleaning | data cleaning, data wrangling
  Business intelligence | BI, dashboards
    Dashboards | charts, KPI dashboard
    Automated reporting | scheduled reports, reporting
  Data collection | data gathering
    Web scraping | scraping, crawler
    API ingestion | API import, ingest
Infrastructure and operations #infra | DevOps, ops, infrastructure
  Cloud infrastructure | cloud
    Infrastructure as code | IaC, Terraform
    Serverless | lambda, functions
    Containers and orchestration | k8s, Kubernetes, Docker
  Delivery | CI/CD, release
    Continuous integration | CI
    Continuous deployment | CD, auto deploy
    Release automation | release management
  Platform engineering | platform team
    Internal developer platforms | IDP, developer portal
  Observability | monitoring and logging
    Logging | logs
    Monitoring and alerting | alerts, uptime
    Incident response | incidents, on-call
  Site reliability | SRE, reliability
    Capacity planning | scaling, capacity
    Postmortems | post-mortem, retrospective
  Cloud cost management | FinOps, cloud costs
    Usage analysis | cost analysis
    Cost optimisation | cost optimization, savings
Security | cybersecurity, infosec, cyber security
  Application security | AppSec
    Code scanning | SAST, static analysis
    Dependency auditing | SCA, vulnerable dependencies
    Secure code review | security review
  Cloud security | cloud posture
    Configuration review | misconfiguration, CSPM
    Secrets management | secrets, vault
  Offensive security | red team, hacking
    Penetration testing | pentest, pen test
    Capture the flag | CTF
  Defensive security | blue team, SOC
    Threat detection | detection engineering, SIEM
    Log analysis | security logs
    Phishing analysis | phishing
    Malware analysis | malware, reverse engineering
  Identity and access | IAM, SSO
  Cryptography | encryption, crypto primitives
  Privacy engineering | privacy, GDPR
    Anonymisation | anonymization, pseudonymisation
    Data retention | retention policy
Embedded systems and hardware #embedded | embedded, hardware, electronics
  Microcontrollers and firmware | Arduino, firmware, MCU
  Circuit and PCB design | PCB, circuits, schematics
  FPGA and digital design | FPGA, Verilog, VHDL
  Internet of things | IoT
    Sensor networks | sensors
    Home automation | smart home, Home Assistant
  Signal processing | DSP
  CAD and 3D printing | CAD, 3D printing, 3D print
Robotics and autonomous systems #robotics | robots, autonomy
  Robot control | robot arm, control systems
  Perception | robot vision, SLAM
  Motion planning | path planning, trajectory
  Drones | UAV, quadcopter
  Simulation | simulator, sim
Scientific and research computing #sci-computing | scientific computing, research computing, computational science
  Bioinformatics | computational biology
    Genomics | sequencing, DNA analysis
    Protein structure | AlphaFold, proteins
    Single-cell analysis | scRNA-seq, single cell
  Computational chemistry | cheminformatics
    Molecular dynamics | MD simulation
    Drug discovery | drug design, virtual screening
  Physics simulation | numerical simulation
  Climate and earth modelling | climate models, earth system
  High-performance computing | HPC, supercomputer, cluster
  Statistical computing | stats, R
    Survey analysis | survey data
    Econometrics | regression, panel data
    Reproducible analysis | reproducibility, notebooks
  Research software engineering | RSE, research software
  Literature mining | text mining papers, systematic review
Quantitative finance #quant-finance | quant, quantitative analysis
  Algorithmic trading #algo-trading | algo trading, trading algorithms
    Signal generation | alpha signals
    Order execution | execution algorithms
  Backtesting | back testing, strategy testing
  Risk modelling | risk model, VaR
  Market data engineering | market data, tick data
  Portfolio optimisation | portfolio optimization, asset allocation
  On-chain analytics | on chain, blockchain analytics
Blockchain and distributed systems #blockchain | blockchain, web3, distributed ledger
  Smart contracts | Solidity, contracts on chain
    Contract auditing | smart contract audit
  Decentralised applications | dapp, dApps, decentralized apps
  Consensus and distributed systems | consensus, Raft, distributed systems
  Wallets | crypto wallet
Networking | network, networks, comms
  Network automation | netops, network scripts
  Protocol analysis | packet analysis, Wireshark
  Self-hosting and home labs | homelab, self hosting, home server
Formal methods and theory #formal | formal methods, theory, theoretical computer science
  Formal verification | verification, model checking
  Proof assistants | Lean, Coq, Isabelle
  Algorithm design | algorithms, complexity
  Optimisation | optimization, operations research
Accessibility engineering #accessibility | accessibility, a11y
  Assistive technology | screen reader, assistive tech
  Accessibility auditing | WCAG, a11y audit
  Alternative text and captions | alt text, captions, subtitles
Web publishing and content systems #web-publishing | CMS, web content
  Content management | CMS, content management system
  Static sites | static site generator, Jekyll, Hugo
  Search optimisation engineering | technical SEO
`;

const TECHNICAL_ROOTS = new Set<string>();
for (const line of FIELD_TECHNICAL.split("\n")) {
  if (line && !line.startsWith(" ")) {
    const body = line.split(" | ")[0].trim();
    const hash = body.indexOf(" #");
    TECHNICAL_ROOTS.add(hash >= 0 ? body.slice(hash + 2).trim() : slugOf(body));
  }
}

/* ── Task (Group › Task) ── */

const TASKS = `
Create | make, generate, produce
  Writing | copywriting, drafting, content
  Presentations | slides, decks, PowerPoint
  Images | pictures, image generation, artwork
  Video | video generation, clips
  Audio and music | music, sound, voiceover
  Code | coding, programming, software
  Designs | mockups, layouts, UI design
  Social content | social posts, social media posts
  Synthetic data | fake data, generated data, test data
Analyse | analyze, analysis
  Quantitative analysis | statistics, number crunching
  Qualitative coding | thematic analysis, interview coding
  Text analysis (NLP) | NLP, sentiment analysis, text mining
  Image analysis | computer vision, photo analysis
  Forecasting | prediction, projections, predictive
  Summarising | summarizing, summaries, tl;dr
Assess | evaluate, judge
  Marking and grading | marking, grading, scoring essays
  Reviewing and critiquing | review, critique, feedback
  Scoring and ranking | scoring, ranking, rating
  Compliance checking | compliance, policy check, audit
  Testing | QA, test cases
Find | search, discover
  Research and search | research, web search, deep research
  Literature review | lit review, papers, systematic review
  Monitoring and alerts | monitoring, alerts, watching
  Data collection | scraping, gathering data
Organise | organize, sort
  Classifying and routing | classification, triage, routing
  Extracting data | extraction, parsing, data extraction
  Planning and scheduling | planning, scheduling, rota
  Cleaning data | data cleaning, tidying data
Communicate | talk, respond
  Answering questions | Q&A, FAQ, question answering
  Customer conversations | customer chat, support chat
  Translation | translating, localisation
  Tutoring and explaining | tutoring, explaining, teaching
  Outreach | cold email, emails, messaging
Act | do, automate
  Executing transactions | payments, trades, purchases
  Updating other systems | CRM updates, integrations, syncing
  Running workflows end to end | end to end automation, workflows
  Controlling devices | smart home, robots, hardware control
`;

/* ── Setting (Group › Setting) ── */

const SETTINGS = `
Personal | individual
  Personal use | for myself, own use
  Hobby | hobbyist, side project
  Family | family use, household
Education | learning
  School teacher | teacher, school staff
  Lecturer | university teacher, professor, academic teaching
  School student | pupil, GCSE student, A level student
  Undergraduate student | undergraduate, uni student, dissertation
  Postgraduate student | postgraduate, masters, PhD, dissertation
  Self-taught learner | self taught, autodidact, bootcamp
Research | researchers
  Academic research | university research, academia
  Clinical research | clinical trials, medical research
  Industry research and development | R&D, industry R&D
  Independent research | independent researcher, citizen science
Work | professional
  Sole trader or freelancer | freelancer, sole trader, self-employed
  Small business | SME, small company, startup
  Large organisation | enterprise, corporate, large company
  Agency | consultancy, studio
Public and community | civic
  Public sector | government, NHS, council
  Charity | nonprofit, non-profit
  Community group | club, society, volunteers
`;

/* ── AI build (derived) ── */

const BUILT = `
Web app | website, web application, site
Mobile app | iOS app, Android app, app
Browser extension | Chrome extension, add-on
API or service | API, backend, microservice
Script or tool | script, CLI, utility
Game | video game
Chatbot or assistant | chatbot, bot, assistant
Configured assistant | custom GPT, GPT, Gem, project
Autonomous agent | agent, AI agent
Multi-agent system | agent team, multi agent
AI feature in a product | AI feature, embedded AI
MCP server | MCP, model context protocol
Automation workflow | workflow, automation, Zap
Fine-tuned model | fine tuned model, custom model
Dataset | data set, corpus
Evaluation suite | eval suite, evals, test suite
Document or report | report, document, write-up
Presentation | slides, deck
Image set | images, picture set
Video | clip, film
Audio | sound, podcast
Spreadsheet or data model | spreadsheet, Excel model, data model
Prompt library | prompts, prompt pack
`;

const ROLE = `
Made with AI | built with AI, AI-assisted
Runs on AI | powered by AI, AI inside
Both | made with and runs on AI
`;

const TECHNIQUES = `
Prompt chain | chained prompts, multi-step prompting
System prompt | system message, instructions
Few-shot examples | few shot, examples in prompt
Prompt variables | template variables, placeholders
Retrieval (RAG) | RAG, retrieval augmented generation
Long documents | long context, large files
Memory | agent memory, remembers
Tool use | function calling, tool calling
MCP | model context protocol
Browser use | browser agent, web browsing
Computer use | computer control, desktop agent
Code execution | code interpreter, sandbox
Single agent | one agent
Multi-agent orchestration | multi agent, orchestration
Human approval steps | human in the loop, HITL, approvals
Structured output | JSON output, schema output
Classification | classifying, labelling
Extraction | extracting, parsing
Fine-tuning | fine tuning, finetuning
Embeddings | embedding, vectors
Evaluations | evals, testing prompts
Guardrails | safety rails, limits
`;

const MODALITY = `
Text to text | text generation, LLM
Text to code | code generation
Text to image | image generation
Image to text | image captioning, vision
Text to video | video generation
Speech to text | transcription, ASR
Text to speech | TTS, voice synthesis
Document to data | document extraction, OCR
Data to report | reporting, data summary
Multimodal | mixed media, vision and text
`;

const METHOD = `
Chat assistant | chat, chatbot app
App builder | no-code builder, vibe coding
AI coding agent | coding agent, agentic coding
Automation platform | automation tool, no-code automation
Agent framework | agent SDK, orchestration framework
Direct API | API, own code, SDK
Local models | local LLM, on-device, self-hosted
Notebook | Jupyter, Colab
`;

const AUTONOMY = `
You do each step | manual, hands on
AI suggests and you approve | human approves, approval
AI acts with approval gates | approval gates, guarded autonomy
Fully autonomous | autonomous, unattended
`;

/* ── Tools and stack (grouped) ── */

const STACK_BASE = `
AI applications #ai-applications
  ChatGPT | OpenAI chat
  Claude | Anthropic
  Gemini | Google Gemini
  Lovable | lovable.dev
  Cursor | Cursor AI
  Claude Code | claudecode
  v0 | v0.dev
  Bolt | bolt.new
Models #models
  Claude | Anthropic model, Sonnet, Opus
  GPT | OpenAI model, GPT-5
  Gemini | Google model
  Llama | Meta Llama
  Mistral | Mistral AI
  Qwen | Alibaba Qwen
  DeepSeek | DeepSeek model
  Whisper | OpenAI Whisper
  Stable Diffusion | SDXL
  Flux | Flux image model
Languages #languages
  Python | py
  TypeScript | TS
  JavaScript | JS, node
  Rust | rustlang
  Go | golang
  Java | JVM
  Kotlin | kt
  Swift | swiftlang
  C | C language
  C++ #cpp | c plus plus
  C# #csharp | csharp, dotnet
  R | R language
  SQL | structured query language
  Julia | julialang
  Solidity | smart contract language
Frameworks #frameworks
  React | reactjs
  Next.js | nextjs, next
  Vue | vuejs
  Svelte | sveltekit
  React Native | RN
  Flutter | Dart
  Django | django python
  FastAPI | fast api
  Rails | Ruby on Rails, RoR
  Laravel | PHP framework
  Unity | Unity engine
  Unreal Engine | Unreal, UE5
  Godot | Godot engine
AI frameworks #ai-frameworks
  PyTorch | torch
  TensorFlow | tf
  JAX | Google JAX
  Transformers | Hugging Face, huggingface
  LangChain | lang chain
  LangGraph | lang graph
  LlamaIndex | llama index
  DSPy | Stanford DSPy
  CrewAI | crew ai
  Ollama | ollama.com
  vLLM | v-llm
Data and storage #data-storage
  PostgreSQL | Postgres, pg
  Supabase | supabase.com
  MongoDB | Mongo
  Redis | redis cache
  SQLite | sqlite3
  DuckDB | duck db
  BigQuery | Google BigQuery, BQ
  Snowflake | snowflake data
  pgvector | pg vector
  Pinecone | pinecone db
  Qdrant | qdrant db
Cloud and infrastructure #cloud
  AWS | Amazon Web Services
  Google Cloud | GCP
  Azure | Microsoft Azure
  Vercel | vercel.com
  Cloudflare | workers
  Docker | containers
  Kubernetes | k8s
  Terraform | IaC
  GitHub Actions | GH Actions, CI
Applications and hardware #applications
  n8n | n8n.io
  Zapier | zaps
  Make | Integromat, make.com
  Shopify | shopify store
  Stata | stata stats
  Excel | Microsoft Excel, spreadsheet
  Google Classroom | classroom
  Arduino | arduino board
  Raspberry Pi | rpi, pi
  ROS 2 | ROS, robot operating system
  CUDA | nvidia cuda, GPU
`;

/* ── Data and oversight, and practicalities ── */

const DATA = `
Public data only | open data, no personal data
Anonymised personal data | anonymised data, de-identified
Personal data | PII, personal information
Health data | medical data, patient data
Student or child data | pupil data, children's data
Financial data | financial records, bank data
Confidential business data | confidential, commercial data, trade secrets
`;

const OVERSIGHT = `
Every output reviewed | all reviewed, human reviewed
Spot checks | sampling, spot-checked
No review | unreviewed, unsupervised
`;

const AGE = `
All ages | any age, everyone
13 and over | 13+, teens
18 and over | 18+, adults only
`;

const SKILL = `
No coding | no-code, non-technical
Some setup | light setup, configuration
Writing code | developer, programming needed
`;

const COST = `
Free plans are enough | free, no cost, free tier
Needs a paid plan | paid, subscription
Extra usage under £10 a month | under 10 pounds, cheap
Extra usage £10 to £50 a month | 10 to 50 pounds
Extra usage over £50 a month | over 50 pounds, expensive
Cost not stated | unknown cost
`;

/* ── Tools and stack: the registry's own apps and models, under the group that fits ── */

const GROUP_OF_TOOL: Record<string, string> = {
  chat: "ai-applications",
  coding: "ai-applications",
  builders: "ai-applications",
  agents: "ai-applications",
  image: "ai-applications",
  video: "ai-applications",
  audio: "ai-applications",
  notes: "ai-applications",
  design: "ai-applications",
  automation: "applications",
  other: "applications",
  services: "applications",
  "runtime-decisions": "ai-frameworks",
  "runtime-context": "ai-frameworks",
  "runtime-frameworks": "ai-frameworks",
  "runtime-tracing": "ai-frameworks",
};

/** Lower case with spaces, dots, dashes and underscores removed: how two spellings of one product are matched. */
const squash = (raw: string): string => raw.toLowerCase().replace(/[\s._-]+/g, "");

function stackValues(): TaxonomyValue[] {
  const base = parse("stack", STACK_BASE, { headings: true });
  const seen = new Set(base.filter((value) => value.parent !== null).map((value) => `${value.parent}|${squash(value.label)}`));
  const known = (tool: Tool, group: string) => [tool.name, tool.id, ...tool.aliases].some((spelling) => seen.has(`${group}|${squash(spelling)}`));
  const extra: TaxonomyValue[] = [];
  for (const tool of TOOLS) {
    const group = GROUP_OF_TOOL[tool.group] ?? "applications";
    // Already listed in this group under the same name: the registry entry is that product.
    if (known(tool, group)) continue;
    // Languages, frameworks and the like that the registry also lists as an app keep their one entry.
    const spellings = [tool.name, tool.id, ...tool.aliases].map(squash);
    if (base.some((value) => value.parent !== null && value.parent !== group && value.parent !== "models" && spellings.includes(squash(value.label)))) continue;
    const id = `${group}.${tool.id}`;
    if (base.some((value) => value.id === id) || extra.some((value) => value.id === id)) continue;
    extra.push({
      id,
      label: tool.name,
      facet: "stack",
      parent: group,
      synonyms: tool.aliases.filter((alias) => alias.toLowerCase() !== tool.name.toLowerCase()).slice(0, 5),
      depth: 1,
      selectable: true,
      pointsTo: [],
    });
    seen.add(`${group}|${squash(tool.name)}`);
  }
  return [...base, ...extra];
}

const plain = (facet: Facet, block: string) => parse(facet, block, { headings: false });

export const FIELD_VALUES: readonly TaxonomyValue[] = (() => {
  const all = [...parse("field", FIELD_GENERAL, { headings: false, branch: () => "general" }), ...parse("field", FIELD_TECHNICAL, { headings: false, branch: () => "technical" })];
  for (const [value, targets] of PENDING_TARGETS) {
    value.pointsTo = targets.flatMap((label) => {
      const found = all.find((candidate) => candidate.label === label);
      return found ? [found.id] : [];
    });
  }
  return all;
})();
export const TASK_VALUES: readonly TaxonomyValue[] = parse("task", TASKS, { headings: true });
export const SETTING_VALUES: readonly TaxonomyValue[] = parse("setting", SETTINGS, { headings: true });
export const BUILT_VALUES: readonly TaxonomyValue[] = plain("built", BUILT);
export const ROLE_VALUES: readonly TaxonomyValue[] = plain("role", ROLE);
export const TECHNIQUE_VALUES: readonly TaxonomyValue[] = plain("technique", TECHNIQUES);
export const MODALITY_VALUES: readonly TaxonomyValue[] = plain("modality", MODALITY);
export const METHOD_VALUES: readonly TaxonomyValue[] = plain("method", METHOD);
export const AUTONOMY_VALUES: readonly TaxonomyValue[] = plain("autonomy", AUTONOMY);
export const STACK_VALUES: readonly TaxonomyValue[] = stackValues();
export const DATA_VALUES: readonly TaxonomyValue[] = plain("data", DATA);
export const OVERSIGHT_VALUES: readonly TaxonomyValue[] = plain("oversight", OVERSIGHT);
export const AGE_VALUES: readonly TaxonomyValue[] = plain("age", AGE);
export const SKILL_VALUES: readonly TaxonomyValue[] = plain("skill", SKILL);
export const COST_VALUES: readonly TaxonomyValue[] = plain("cost", COST);

/** Every list, by facet. */
export const TAXONOMY: Readonly<Record<Facet, readonly TaxonomyValue[]>> = {
  field: FIELD_VALUES,
  task: TASK_VALUES,
  setting: SETTING_VALUES,
  built: BUILT_VALUES,
  role: ROLE_VALUES,
  technique: TECHNIQUE_VALUES,
  modality: MODALITY_VALUES,
  method: METHOD_VALUES,
  autonomy: AUTONOMY_VALUES,
  stack: STACK_VALUES,
  data: DATA_VALUES,
  oversight: OVERSIGHT_VALUES,
  age: AGE_VALUES,
  skill: SKILL_VALUES,
  cost: COST_VALUES,
};

export const FACETS = Object.keys(TAXONOMY) as Facet[];

/** The facets the maker sets in the Card; the rest are read from the build (and the maker can dispute some). */
export const DECLARED_FACETS: readonly Facet[] = ["field", "task", "setting", "data", "age", "stack"];
/** The facets that are worked out from the build. */
export const DERIVED_FACETS: readonly Facet[] = ["built", "role", "technique", "modality", "method", "autonomy", "stack", "oversight", "skill", "cost"];
/** The derived facets whose value the maker can dispute. */
export const DISPUTABLE_FACETS: readonly Facet[] = ["oversight", "skill", "cost", "built"];

const BY_KEY: ReadonlyMap<string, TaxonomyValue> = new Map(FACETS.flatMap((facet) => TAXONOMY[facet].map((value) => [`${facet}:${value.id}`, value] as const)));

/** The value with this id in this facet, or null. */
export function valueOf(facet: Facet, id: string): TaxonomyValue | null {
  return BY_KEY.get(`${facet}:${id}`) ?? null;
}

export function isKnown(facet: Facet, id: string): boolean {
  return BY_KEY.has(`${facet}:${id}`);
}

/** The value whose label (or a synonym) is exactly this, ignoring case; null when none. */
export function valueByLabel(facet: Facet, text: string): TaxonomyValue | null {
  const key = text.trim().toLowerCase();
  if (!key) return null;
  return TAXONOMY[facet].find((value) => value.label.toLowerCase() === key) ?? null;
}

/** The ids above this one, nearest first: its parent, then that one's parent. Field ids only have these; others return []. */
export function ancestorsOf(id: string, facet: Facet = "field"): string[] {
  const out: string[] = [];
  let current = valueOf(facet, id);
  while (current?.parent) {
    out.push(current.parent);
    current = valueOf(facet, current.parent);
  }
  return out;
}

/** "Area › Field › Specialism": the labels from the top down. */
export function pathOf(id: string, facet: Facet = "field"): string {
  const value = valueOf(facet, id);
  if (!value) return id;
  return [...ancestorsOf(id, facet).reverse(), id].map((part) => valueOf(facet, part)?.label ?? part).join(" › ");
}

/** The facet a bare id belongs to is not known from the id; callers pass it. This finds the label for display. */
export function labelOf(facet: Facet, id: string): string {
  return valueOf(facet, id)?.label ?? id;
}

const norm = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Matches labels and synonyms, case-insensitive: values whose label starts with the text first, then whose synonym
 * does, then whose label contains it, then a synonym. An entry point also offers the values it points to, straight
 * after it. Only values that can be chosen are returned.
 */
export function findValues(facet: Facet, text: string, limit?: number): TaxonomyValue[] {
  const q = norm(text);
  if (!q) return [];
  const tiers: TaxonomyValue[][] = [[], [], [], []];
  for (const value of TAXONOMY[facet]) {
    if (!value.selectable) continue;
    const label = value.label.toLowerCase();
    const synonyms = value.synonyms.map((synonym) => synonym.toLowerCase());
    if (label.startsWith(q)) tiers[0].push(value);
    else if (synonyms.some((synonym) => synonym.startsWith(q))) tiers[1].push(value);
    else if (label.includes(q)) tiers[2].push(value);
    else if (synonyms.some((synonym) => synonym.includes(q))) tiers[3].push(value);
  }
  const out: TaxonomyValue[] = [];
  const seen = new Set<string>();
  const add = (value: TaxonomyValue) => {
    if (seen.has(value.id)) return;
    seen.add(value.id);
    out.push(value);
  };
  for (const value of tiers.flat()) {
    add(value);
    for (const target of value.pointsTo) {
      const pointed = valueOf(facet, target);
      if (pointed) add(pointed);
    }
  }
  return limit === undefined ? out : out.slice(0, limit);
}

/** Every facet's values that this whole term names (a label or synonym equal to it, or an entry that starts with it at 3+ letters). */
export function findAcross(text: string): { facet: Facet; value: TaxonomyValue }[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const out: { facet: Facet; value: TaxonomyValue }[] = [];
  for (const facet of FACETS) {
    for (const value of TAXONOMY[facet]) {
      if (!value.selectable) continue;
      const names = [value.label, ...value.synonyms].map((name) => name.toLowerCase());
      if (names.some((name) => name === q)) out.push({ facet, value });
    }
  }
  return out;
}

/** Whether a Field id sits in the technical branch. */
export const isTechnicalField = (id: string): boolean => TECHNICAL_ROOTS.has(id.split(".")[0]);

/** The roots of the Field list whose builds count as a regulated area. */
export const REGULATED_FIELD_ROOTS: readonly string[] = ["medicine", "law", "finance", "quant-finance"];

/** The Data handled ids that make a build a regulated area. */
export const REGULATED_DATA: readonly string[] = ["health-data", "student-or-child-data", "financial-data"];

export const FIELD_MAX = 3;
export const TASK_MAX = 3;
export const SETTING_MAX = 2;
export const CUSTOM_MAX_LENGTH = 60;

/* ── matching a name against Tools and stack ── */

const STACK_INDEX: ReadonlyMap<string, TaxonomyValue[]> = (() => {
  const map = new Map<string, TaxonomyValue[]>();
  for (const value of STACK_VALUES) {
    if (!value.selectable) continue;
    for (const spelling of [value.label, ...value.synonyms]) {
      const key = squash(spelling);
      if (!key) continue;
      const list = map.get(key) ?? [];
      if (!list.includes(value)) list.push(value);
      map.set(key, list);
    }
  }
  return map;
})();

const GROUP_ORDER: Record<"app" | "model" | "language", string[]> = {
  app: ["ai-applications", "applications", "cloud", "data-storage", "ai-frameworks", "frameworks", "languages", "models"],
  model: ["models", "ai-applications", "ai-frameworks", "applications", "cloud", "data-storage", "frameworks", "languages"],
  language: ["languages", "frameworks", "ai-frameworks", "applications", "ai-applications", "cloud", "data-storage", "models"],
};

/** A model's own name ("claude-sonnet-4", "gpt-5-6-sol") read as the model family the lists name. */
const MODEL_FAMILIES: readonly [RegExp, string][] = [
  [/claude|sonnet|opus|haiku/i, "models.claude"],
  [/\bgpt|chatgpt|\bo[1-9]\b/i, "models.gpt"],
  [/gemini|nano-banana|veo/i, "models.gemini"],
  [/llama/i, "models.llama"],
  [/mistral|mixtral/i, "models.mistral"],
  [/qwen/i, "models.qwen"],
  [/deepseek/i, "models.deepseek"],
  [/whisper/i, "models.whisper"],
  [/stable.?diffusion|sdxl/i, "models.stable-diffusion"],
  [/flux/i, "models.flux"],
];

/**
 * The Tools and stack value a name belongs to, or null. A name is matched by label and synonym with spaces, dots and dashes
 * ignored. `prefer` settles a name that two groups share ("Claude" is an app and a model): an app by default, the model
 * for a model's own name, which is also read as its family.
 */
export function stackFor(name: string, prefer: "app" | "model" | "language" = "app"): TaxonomyValue | null {
  const key = squash(name);
  if (!key) return null;
  const hits = STACK_INDEX.get(key);
  if (hits && hits.length > 0) {
    const order = GROUP_ORDER[prefer];
    return [...hits].sort((a, b) => order.indexOf(a.parent ?? "") - order.indexOf(b.parent ?? ""))[0];
  }
  if (prefer === "model") {
    const family = MODEL_FAMILIES.find(([pattern]) => pattern.test(name));
    if (family) return valueOf("stack", family[1]);
  }
  return null;
}
