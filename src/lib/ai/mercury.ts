import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { z } from "zod";

import {
  assertMercuryKey,
  type MercuryReasoningEffort,
  type ServerEnv,
} from "@/lib/openai/env";

/**
 * Mercury (Inception Labs の拡散型LLM) は OpenAI の Chat Completions 互換 API のみを
 * 提供し、Responses API は使えない。テキスト生成ルートはこのヘルパー経由で
 * Chat Completions + response_format(json_schema) を呼ぶ。
 *
 * 自己回帰モデルとの違いと、それに合わせた扱い（Vercel AI Gateway 経由で実測）:
 * - response_format の JSON Schema がモデルに届かず、キーが欠けた JSON や日本語キーの
 *   JSON が返る。スキーマ本文をシステムプロンプトにも書いて渡し、それでも形が合わない
 *   ときは 1 回だけ作り直す（Mercury は 1〜2 秒で返るので、やり直しの負担は小さい）。
 * - 推論トークンは本文の前にまとめて生成され、ストリームには流れない。本文は数百文字ずつ
 *   3〜8 回に分かれて届く。途中表示は粗くなるが、追記型の delta としてそのまま扱える。
 *   拡散の途中経過（diffusing）は Gateway では使えないので使わない。
 * - reasoning_effort の語彙が接続先で違う（Inception: instant/low/medium/high、
 *   Gateway: none/minimal/low/medium/high）ので、接続先に合わせて読み替える。
 */

export type MercurySpeed = "fast" | "standard";

export type MercuryStructuredRequest<Schema extends z.ZodType> = {
  env: ServerEnv;
  model: string;
  instructions?: string;
  input: string;
  schema: Schema;
  name: string;
  maxOutputTokens?: number;
  speed?: MercurySpeed;
  // speed より優先して使う推論の強さ（フェルミ推定など、機能ごとに決めたいとき）
  reasoningEffort?: MercuryReasoningEffort;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * Responses API の ParsedResponse と同じ形（output_parsed / usage）で返し、
 * 呼び出し側の `response.output_parsed` と `extractOpenAIUsage(response)` を
 * そのまま使えるようにする。usage は作り直した分も合算する。
 */
export type MercuryStructuredResult<T> = {
  output_parsed: T | null;
  usage: unknown;
};

// 形が合わなかったときに作り直す回数
const MAX_RETRIES = 1;

// 推論トークンは max_completion_tokens に含まれる。実測では medium で 1,500 前後まで
// 膨らむことがあり、本文の分まで使い切ると finish_reason=length で JSON が途中で切れる。
// 呼び出し側の maxOutputTokens（本文の上限）に、推論の強さに応じた余白を足して送る。
const reasoningHeadroomTokens: Record<string, number> = {
  none: 0,
  instant: 0,
  minimal: 512,
  low: 2048,
  medium: 4096,
  high: 8192,
  xhigh: 8192,
  max: 8192,
};

export function mercuryMaxCompletionTokens(
  maxOutputTokens: number,
  providerReasoningEffort: string,
): number {
  return (
    maxOutputTokens + (reasoningHeadroomTokens[providerReasoningEffort] ?? 4096)
  );
}

const SCHEMA_INSTRUCTIONS =
  "出力は次の JSON Schema に厳密に従う JSON オブジェクト1つだけにしてください。キー名は英語のまま変えず、required のキーをすべて含めてください。";

export function createMercuryClient(
  env: ServerEnv,
  options: { timeoutMs?: number } = {},
): OpenAI {
  return new OpenAI({
    apiKey: assertMercuryKey(env),
    baseURL: env.MERCURY_BASE_URL,
    timeout: options.timeoutMs,
  });
}

export function isAiGatewayBaseUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return (
      hostname === "ai-gateway.vercel.sh" ||
      hostname.endsWith(".ai-gateway.vercel.sh")
    );
  } catch {
    return false;
  }
}

export function toProviderReasoningEffort(
  baseUrl: string,
  effort: MercuryReasoningEffort,
): string {
  if (isAiGatewayBaseUrl(baseUrl)) {
    // Gateway は Mercury の instant を 400 で弾く。推論なしの none が最速。
    return effort === "instant" ? "none" : effort;
  }
  // Inception の API は none / minimal を知らないので、推論なしの instant に寄せる。
  return effort === "none" || effort === "minimal" ? "instant" : effort;
}

function reasoningEffortFor(
  env: ServerEnv,
  speed: MercurySpeed | undefined,
): MercuryReasoningEffort {
  return speed === "fast"
    ? env.MERCURY_FAST_REASONING_EFFORT
    : env.MERCURY_REASONING_EFFORT;
}

export function buildMercuryRequestBody<Schema extends z.ZodType>(
  request: MercuryStructuredRequest<Schema>,
) {
  const responseFormat = zodResponseFormat(request.schema, request.name);
  const schemaText = JSON.stringify(responseFormat.json_schema.schema ?? {});
  const system = [request.instructions, `${SCHEMA_INSTRUCTIONS}\n${schemaText}`]
    .filter(Boolean)
    .join("\n\n");
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: request.input },
  ];
  const reasoningEffort = toProviderReasoningEffort(
    request.env.MERCURY_BASE_URL,
    request.reasoningEffort ?? reasoningEffortFor(request.env, request.speed),
  );

  return {
    model: request.model,
    messages,
    response_format: responseFormat,
    ...(request.maxOutputTokens
      ? {
          max_completion_tokens: mercuryMaxCompletionTokens(
            request.maxOutputTokens,
            reasoningEffort,
          ),
        }
      : {}),
    // Mercury 独自の値（instant など）を含むため OpenAI SDK の型から外れる。
    reasoning_effort: reasoningEffort,
  };
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

export function parseMercuryJson<Schema extends z.ZodType>(
  schema: Schema,
  content: string | null | undefined,
): z.infer<Schema> | null {
  if (!content) {
    return null;
  }
  try {
    const result = schema.safeParse(JSON.parse(stripCodeFence(content)));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function detailOf(value: unknown, key: string): number {
  return typeof value === "object" && value !== null
    ? countOf((value as Record<string, unknown>)[key])
    : 0;
}

// 作り直した分も含めて精算できるよう、Chat Completions の usage を足し合わせる。
export function addMercuryUsage(total: unknown, next: unknown): unknown {
  if (!total || typeof total !== "object") {
    return next;
  }
  if (!next || typeof next !== "object") {
    return total;
  }
  const a = total as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  return {
    prompt_tokens: countOf(a.prompt_tokens) + countOf(b.prompt_tokens),
    completion_tokens:
      countOf(a.completion_tokens) + countOf(b.completion_tokens),
    total_tokens: countOf(a.total_tokens) + countOf(b.total_tokens),
    prompt_tokens_details: {
      cached_tokens:
        detailOf(a.prompt_tokens_details, "cached_tokens") +
        detailOf(b.prompt_tokens_details, "cached_tokens"),
    },
    completion_tokens_details: {
      reasoning_tokens:
        detailOf(a.completion_tokens_details, "reasoning_tokens") +
        detailOf(b.completion_tokens_details, "reasoning_tokens"),
    },
  };
}

export async function generateMercuryStructured<Schema extends z.ZodType>(
  request: MercuryStructuredRequest<Schema>,
): Promise<MercuryStructuredResult<z.infer<Schema>>> {
  const client = createMercuryClient(request.env, {
    timeoutMs: request.timeoutMs,
  });
  const body = buildMercuryRequestBody(request);

  let usage: unknown = undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await client.chat.completions.create(
      body as unknown as ChatCompletionCreateParamsNonStreaming,
      { signal: request.signal },
    );
    usage = addMercuryUsage(usage, response.usage);
    const parsed = parseMercuryJson(
      request.schema,
      response.choices[0]?.message.content,
    );
    if (parsed !== null) {
      return { output_parsed: parsed, usage };
    }
  }
  return { output_parsed: null, usage };
}

/**
 * JSON 文字列をストリーミングで受け取りながら onDelta に累積バッファを渡す。
 * 作り直すときは新しい出力のバッファを最初から渡し直す。
 */
export async function streamMercuryStructured<Schema extends z.ZodType>(
  request: MercuryStructuredRequest<Schema>,
  onDelta: (buffer: string) => void,
): Promise<MercuryStructuredResult<z.infer<Schema>>> {
  const client = createMercuryClient(request.env, {
    timeoutMs: request.timeoutMs,
  });
  const body = {
    ...buildMercuryRequestBody(request),
    stream: true,
    stream_options: { include_usage: true },
  };

  let usage: unknown = undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const stream = await client.chat.completions.create(
      body as unknown as ChatCompletionCreateParamsStreaming,
      { signal: request.signal },
    );

    let buffer = "";
    let attemptUsage: unknown = undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        buffer += delta;
        onDelta(buffer);
      }
      if (chunk.usage) {
        attemptUsage = chunk.usage;
      }
    }

    usage = addMercuryUsage(usage, attemptUsage);
    const parsed = parseMercuryJson(request.schema, buffer);
    if (parsed !== null) {
      return { output_parsed: parsed, usage };
    }
  }
  return { output_parsed: null, usage };
}
