import { readFileSync } from "node:fs";
import { join } from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import {
  buildProfileImportInput,
  PROFILE_IMPORT_INSTRUCTIONS,
} from "@/lib/prompts/profile-import";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  profileFileImportOutputSchema,
  profileFileImportRequestSchema,
  userProfileSchema,
  type ProfileFileImportOutput,
  type ProfileFileImportRequest,
} from "@/lib/schemas/interview";
import { estimateProfileImportTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { extractOpenAIUsage } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxImportedFileBytes = 12 * 1024 * 1024;
const maxImportedTextChars = 50000;

let pdfWorkerDataUrl: string | null = null;
let pdfjsPromise: Promise<
  typeof import("pdfjs-dist/legacy/build/pdf.mjs")
> | null = null;

class PdfFallbackDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  translateSelf(x = 0, y = 0) {
    this.e += x;
    this.f += y;
    return this;
  }

  scaleSelf(scaleX = 1, scaleY = scaleX) {
    this.a *= scaleX;
    this.d *= scaleY;
    return this;
  }

  multiplySelf() {
    return this;
  }

  preMultiplySelf() {
    return this;
  }

  rotateSelf() {
    return this;
  }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) {
      return this;
    }

    const { a, b, c, d, e, f } = this;
    this.a = d / determinant;
    this.b = -b / determinant;
    this.c = -c / determinant;
    this.d = a / determinant;
    this.e = (c * f - d * e) / determinant;
    this.f = (b * e - a * f) / determinant;
    return this;
  }
}

class PdfFallbackImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? Math.floor(data.length / 4 / width);
  }
}

class PdfFallbackPath2D {
  addPath() {}
}

function ensurePdfRuntimeGlobals() {
  const globals = globalThis as typeof globalThis & {
    DOMMatrix: typeof DOMMatrix;
    ImageData: typeof ImageData;
    Path2D: typeof Path2D;
  };

  globals.DOMMatrix ??= PdfFallbackDOMMatrix as unknown as typeof DOMMatrix;
  globals.ImageData ??= PdfFallbackImageData as unknown as typeof ImageData;
  globals.Path2D ??= PdfFallbackPath2D as unknown as typeof Path2D;
}

async function loadPdfjs() {
  if (!pdfjsPromise) {
    ensurePdfRuntimeGlobals();
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  return pdfjsPromise;
}

function getPdfWorkerDataUrl(): string {
  if (!pdfWorkerDataUrl) {
    const workerPath = join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
    const workerSource = readFileSync(workerPath);
    pdfWorkerDataUrl = `data:text/javascript;base64,${Buffer.from(
      workerSource,
    ).toString("base64")}`;
  }

  return pdfWorkerDataUrl;
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isTextLikeFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    [".txt", ".md", ".csv", ".json"].some((extension) =>
      lowerName.endsWith(extension),
    )
  );
}

async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions, VerbosityLevel } =
    await loadPdfjs();
  GlobalWorkerOptions.workerSrc = getPdfWorkerDataUrl();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({
    data: bytes,
    verbosity: VerbosityLevel.ERRORS,
  });
  const document = await loadingTask.promise;

  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pageTexts.push(text);
      page.cleanup();
    }
    return pageTexts.join("\n\n");
  } finally {
    await document.destroy();
  }
}

async function extractTextFromUploadedFile(file: File): Promise<string> {
  if (file.size > maxImportedFileBytes) {
    throw new Error("ファイルサイズは12MB以下にしてください。");
  }

  if (isPdfFile(file)) {
    return extractPdfText(file);
  }

  if (isTextLikeFile(file)) {
    return file.text();
  }

  throw new Error("対応形式はPDF、txt、md、csv、jsonです。");
}

function clipText(text: string): string {
  return Array.from(text.replace(/\u0000/g, "").trim())
    .slice(0, maxImportedTextChars)
    .join("");
}

async function parseImportRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return profileFileImportRequestSchema.parse(await request.json());
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("ファイルが送信されていません。");
  }

  const currentProfileRaw = formData.get("currentProfile");
  const currentProfile =
    typeof currentProfileRaw === "string" && currentProfileRaw
      ? userProfileSchema.nullable().parse(JSON.parse(currentProfileRaw))
      : null;
  const extractedText = clipText(await extractTextFromUploadedFile(file));

  if (extractedText.length < 20) {
    throw new Error("PDFから読み取れる文字情報が少なすぎます。");
  }

  return profileFileImportRequestSchema.parse({
    fileName: file.name,
    fileText: extractedText,
    currentProfile,
  });
}

function mockImportProfile(
  request: ProfileFileImportRequest,
): ProfileFileImportOutput {
  const source = request.fileText.replace(/\s+/g, " ").trim();
  const clipped = Array.from(source).slice(0, 900).join("");
  const label =
    request.currentProfile?.label ||
    request.fileName.replace(/\.[^.]+$/, "") ||
    "取り込みプロフィール";

  return {
    label,
    nameOrAlias: request.currentProfile?.nameOrAlias ?? "",
    affiliation: request.currentProfile?.affiliation ?? "",
    selfText: [
      "## ファイルから整理した自己情報",
      clipped,
      "",
      "## 面接で使う観点",
      "アップロードした内容をもとに、経験、役割、成果、強み、弱みを面接回答の材料として整理します。",
    ].join("\n"),
    forbiddenInformation: request.currentProfile?.forbiddenInformation ?? "",
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await parseImportRequest(request);
    const env = getServerEnv();
    const rateLimit = checkRateLimit({
      key: `${auth.user.id}:import-profile-file`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "import-profile-file",
      provider: env.AI_PROVIDER,
      model: env.CLASSIFIER_MODEL,
      estimatedAmount: estimateProfileImportTokens(body),
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, {
        inputTokens: Math.ceil(body.fileText.length / 3),
        outputTokens: 350,
      });
      return Response.json(mockImportProfile(body));
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model: env.CLASSIFIER_MODEL,
          instructions: PROFILE_IMPORT_INSTRUCTIONS,
          input: buildProfileImportInput(body),
          text: {
            format: zodTextFormat(
              profileFileImportOutputSchema,
              "profile_file_import",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );

      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("プロフィール下書きの解析に失敗しました", 502);
      }

      await settleAiTokens(reservation, extractOpenAIUsage(response));
      return Response.json(response.output_parsed);
    } catch (error) {
      await releaseAiTokenReservation(reservation, "api_failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof TokenBalanceError) {
      return jsonError(error.message, error.status);
    }
    return jsonError(toPublicError(error), 400);
  }
}
