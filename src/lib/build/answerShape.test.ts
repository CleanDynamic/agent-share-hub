import { describe, expect, it } from "vitest";

import { apiOf, outputShapeOf, schemaFileNames, schemaName, shapeChip, shapeFragment, shapeRefusal } from "./answerShape";
import { traceLabel, traceRefusal, traceUrlOf } from "./trace";

const schema = JSON.stringify({ title: "Order", type: "object", properties: { id: { type: "string" } }, required: ["id"] });

describe("answer shape (CA-13 P7)", () => {
  it("reads defensively and needs a known how", () => {
    expect(outputShapeOf(null)).toBeNull();
    expect(outputShapeOf({ how: "nope" })).toBeNull();
    expect(outputShapeOf({ how: "json-schema", where: " Claude API ", schema, sample: "{}" })).toEqual({ how: "json-schema", where: "Claude API", schema, sample: "{}" });
  });

  it("names the chip from the schema's title, else JSON", () => {
    expect(schemaName(schema)).toBe("Order");
    expect(schemaName("{}")).toBe("JSON");
    expect(schemaName("not json")).toBe("JSON");
    expect(shapeChip({ how: "json-schema", schema })).toBe("Returns JSON · Order");
    expect(shapeChip({ how: "json-schema", schema: "{}" })).toBe("Returns JSON · JSON");
    expect(shapeChip({ how: "grammar" })).toBe("Returns a fixed shape · grammar");
  });

  it("refuses a schema-based shape with no schema, and a schema over 20,000 characters", () => {
    expect(shapeRefusal({ how: "json-schema" })).toBe("This answer shape needs its schema.");
    expect(shapeRefusal({ how: "grammar" })).toBeNull();
    expect(shapeRefusal({ how: "json-schema", schema: "x".repeat(20_001) })).toMatch(/20,000/);
  });

  it("writes the exact fragment for the Claude API, OpenAI and Gemini", () => {
    const claude = shapeFragment({ how: "json-schema", where: "Claude API", schema });
    expect(claude.exact).toBe(true);
    expect(JSON.parse(claude.text)).toEqual({ output_config: { format: { type: "json_schema", schema: JSON.parse(schema) } } });
    const openai = JSON.parse(shapeFragment({ how: "json-schema", where: "OpenAI", schema }).text);
    expect(openai.response_format.type).toBe("json_schema");
    expect(openai.response_format.json_schema).toMatchObject({ name: "Order", strict: true, schema: JSON.parse(schema) });
    const gemini = JSON.parse(shapeFragment({ how: "json-schema", where: "Gemini", schema }).text);
    expect(gemini.generationConfig).toEqual({ responseMimeType: "application/json", responseSchema: JSON.parse(schema) });
  });

  it("copies just the schema for any other provider", () => {
    expect(shapeFragment({ how: "json-schema", where: "vLLM", schema })).toEqual({ text: schema, exact: false });
    expect(shapeFragment({ how: "grammar", where: "llama.cpp", schema: "root ::= x" })).toEqual({ text: "root ::= x", exact: false });
    expect(apiOf("Claude API")).toBe("claude");
    expect(apiOf("vLLM")).toBeNull();
  });

  it("offers a file named *.schema.json from the build", () => {
    expect(schemaFileNames(["notes.md", "order.schema.json", null, "ORDER2.SCHEMA.JSON"])).toEqual(["order.schema.json", "ORDER2.SCHEMA.JSON"]);
  });
});

describe("trace link (CA-13 P5)", () => {
  it("accepts https only", () => {
    expect(traceUrlOf("https://smith.langchain.com/o/1/projects/p/r/abc")).toBe("https://smith.langchain.com/o/1/projects/p/r/abc");
    expect(traceUrlOf("http://smith.langchain.com/x")).toBeNull();
    expect(traceUrlOf("javascript:alert(1)")).toBeNull();
    expect(traceUrlOf("smith.langchain.com")).toBeNull();
    expect(traceRefusal("http://x.com")).toBe("A trace link starts with https://.");
    expect(traceRefusal("")).toBeNull();
  });
  it("names LangSmith, and shows any other host as its domain", () => {
    expect(traceLabel("https://smith.langchain.com/o/1")).toBe("LangSmith");
    expect(traceLabel("https://www.example.com/t/1")).toBe("example.com");
  });
});
