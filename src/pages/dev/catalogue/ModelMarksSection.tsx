/* UI-P83 — the Model marks section, built like design/reference/refined/{dusk,noon}/model-marks.html.

   Every lab at 14, 16, 20, 24 and 28 with the models it names, the tool rows, a tag and a chip. The board draws each
   mark as a tile with an initial; that is its placeholder, and this section draws the real logo alone, with no tile.
   That is the one expected difference. */

import { ModelChip } from "@/components/brand/ModelChip";
import { ModelMark, type ModelMarkSize } from "@/components/brand/ModelMark";
import { ModelTag } from "@/components/brand/ModelTag";
import { LABS, MODEL_VERSIONS, type Lab } from "@/lib/models/registry";
import { markFor } from "@/lib/models/marks";
import { TOOL_GROUPS, toolsInGroup } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Example, Row, Section } from "./parts";

const SIZES: readonly ModelMarkSize[] = [14, 16, 20, 24, 28];

/** The tools the board names, with what each is shown doing. */
const TOOLS = [
  { tool: "ChatGPT", detail: "GPT-6 Astra · step 1" },
  { tool: "Claude", detail: "Opus 5.5 · step 2" },
  { tool: "Gemini", detail: "Gemini 4 Argon · step 3" },
  { tool: "Claude Code", detail: "Sonnet 5.5 · steps 4 to 5" },
  { tool: "Cursor", detail: "GPT-6.1 Sol · step 6" },
  { tool: "Grok", detail: "Grok 4.7 · step 7" },
  { tool: "Vercel", detail: "an account · step 8" },
  { tool: "Gmail", detail: "an account · step 9" },
] as const;

const text = (size: number, weight: number, color: string) => ({
  fontFamily: FIGTREE,
  fontSize: size,
  fontWeight: weight,
  color,
});

const modelsOf = (lab: Lab) => MODEL_VERSIONS.filter((m) => m.lab === lab).map((m) => m.name);

export function ModelMarksSection() {
  return (
    <Section name="Model marks" note="the real logo beside the name: no tile, no background, no border">
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
        {LABS.map((lab) => (
          <div
            key={lab}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 140px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 16,
              minHeight: 56,
              borderBottom: `1px solid ${t.hairline}`,
            }}
          >
            <ModelMark lab={lab} size={28} />
            <span style={text(13, 500, t.text)}>{lab}</span>
            <span style={text(12, 400, t.text2)}>{modelsOf(lab).join(" · ")}</span>
            {markFor({ lab }) ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {SIZES.map((size) => (
                  <span key={size} style={{ width: 32, display: "inline-flex", justifyContent: "center" }}>
                    <ModelMark lab={lab} size={size} />
                  </span>
                ))}
              </span>
            ) : (
              <span style={text(11.5, 400, t.label)}>No logo yet</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
        {TOOLS.map(({ tool, detail }) => (
          <div
            key={tool}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              borderBottom: `1px solid ${t.hairline}`,
            }}
          >
            <ModelMark tool={tool} size={28} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={text(13, 500, t.text)}>{tool}</span>
              <span style={text(11.5, 400, t.label)}>{detail}</span>
            </div>
          </div>
        ))}
      </div>

      {TOOL_GROUPS.map((group) => (
        <div key={group.key} style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
          <span style={{ ...text(12, 500, t.text2), padding: "8px 0" }}>{group.label}</span>
          {toolsInGroup(group.key).map((tool) => (
            <div
              key={tool.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: 48,
                borderBottom: `1px solid ${t.hairline}`,
              }}
            >
              <span style={{ width: 28, display: "inline-flex", justifyContent: "center" }}>
                <ModelMark tool={tool.id} size={16} />
              </span>
              <span style={{ width: 28, display: "inline-flex", justifyContent: "center" }}>
                <ModelMark tool={tool.id} size={28} />
              </span>
              <span style={text(13, 500, t.text)}>{tool.name}</span>
              {tool.logo === null ? <span style={text(11.5, 400, t.label)}>No logo yet</span> : null}
            </div>
          ))}
        </div>
      ))}

      <Row style={{ alignItems: "flex-start" }}>
        <Example caption="tag, mark 14">
          <Row gap={8}>
            <ModelTag model="Opus 5.5">Opus 5.5</ModelTag>
            <ModelTag model="GPT-6 Astra">GPT-6 Astra</ModelTag>
            <ModelTag tool="Claude Code">Claude Code</ModelTag>
            <ModelTag tool="Mystery">No logo</ModelTag>
          </Row>
        </Example>
        <Example caption="chip, mark 20; pressed is the selected recipe">
          <Row gap={8}>
            <ModelChip tool="Claude">Claude</ModelChip>
            <ModelChip tool="ChatGPT" pressed>
              ChatGPT
            </ModelChip>
            <ModelChip tool="Cursor">Cursor</ModelChip>
          </Row>
        </Example>
      </Row>
    </Section>
  );
}
