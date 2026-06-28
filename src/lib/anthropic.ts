// Server-only: the actual Claude vision call.

import Anthropic from "@anthropic-ai/sdk";
import {
  GRADE_JSON_SCHEMA,
  SYSTEM_PROMPT,
  resolveModel,
  validateAndRepair,
} from "./grading";
import type { GradeResult } from "./types";

export type InputImage = { base64: string };
export type GradeInput = {
  front: InputImage;
  back?: InputImage;
  closeups: InputImage[];
};

export class GradeError extends Error {
  code: "refusal" | "parse" | "empty" | "upstream";
  status: number;
  constructor(
    code: GradeError["code"],
    message: string,
    status = 502,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Block = Anthropic.ContentBlockParam;

function imageBlock(base64: string): Block {
  // Client always re-encodes to JPEG, so media_type is fixed and the base64
  // has no data: prefix (stripped client-side).
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: base64 },
  };
}

function buildContent(input: GradeInput): Block[] {
  const blocks: Block[] = [];
  blocks.push({ type: "text", text: "FRONT of the card:" });
  blocks.push(imageBlock(input.front.base64));
  if (input.back) {
    blocks.push({ type: "text", text: "BACK of the card:" });
    blocks.push(imageBlock(input.back.base64));
  }
  input.closeups.forEach((c, i) => {
    blocks.push({ type: "text", text: `Close-up ${i + 1}:` });
    blocks.push(imageBlock(c.base64));
  });
  blocks.push({
    type: "text",
    text: `Grade this card from the image(s) above. ${
      input.back ? "" : "No back photo was provided — set the back centering ratios to \"not-provided\". "
    }${
      input.closeups.length
        ? "Use the close-ups to judge corners, edges, and surface in detail."
        : "No close-ups were provided — cap corner/edge/surface subgrades that you cannot confirm at full-card resolution, and say so."
    } Follow the rubric exactly: observe each pillar before grading, and never award a grade the photos cannot support.`,
  });
  return blocks;
}

function extractJsonText(message: Anthropic.Message): string | null {
  for (const block of message.content) {
    if (block.type === "text" && block.text.trim()) return block.text;
  }
  return null;
}

const client = new Anthropic();

export async function gradeCard(input: GradeInput): Promise<GradeResult> {
  const model = resolveModel();
  const content = buildContent(input);

  // Opus 4.8: adaptive thinking only (no budget_tokens), no temperature/top_p/
  // top_k (all 400), structured output via output_config.format, effort high.
  async function call(maxTokens: number): Promise<Anthropic.Message> {
    return client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: GRADE_JSON_SCHEMA,
        },
      },
      messages: [{ role: "user", content }],
    });
  }

  let message: Anthropic.Message;
  try {
    message = await call(16000);
    // Always check stop_reason before reading content.
    if (message.stop_reason === "refusal") {
      throw new GradeError(
        "refusal",
        "The model declined to analyse this image. Try a clearer card photo.",
        422,
      );
    }
    if (message.stop_reason === "max_tokens") {
      message = await call(32000);
    }
  } catch (err) {
    if (err instanceof GradeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new GradeError(
        "upstream",
        "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.",
        401,
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new GradeError("upstream", `Anthropic API error: ${err.message}`, 502);
    }
    throw err;
  }

  const jsonText = extractJsonText(message);
  if (!jsonText) {
    throw new GradeError("empty", "The model returned no gradable output.", 502);
  }

  try {
    return validateAndRepair(JSON.parse(jsonText));
  } catch {
    // One informed retry: show the model its bad output and ask for clean JSON.
    const retry = await client.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: GRADE_JSON_SCHEMA,
        },
      },
      messages: [
        { role: "user", content },
        { role: "assistant", content: message.content },
        {
          role: "user",
          content:
            "That response could not be parsed against the required schema. Return ONLY the JSON object that matches the schema, nothing else.",
        },
      ],
    });

    const retryText = extractJsonText(retry);
    if (!retryText) {
      throw new GradeError("parse", "Could not read a grade from the model.", 502);
    }
    try {
      return validateAndRepair(JSON.parse(retryText));
    } catch {
      throw new GradeError(
        "parse",
        "The model's grade did not match the expected format.",
        502,
      );
    }
  }
}
