import { readFileSync } from "node:fs";
import { join } from "node:path";

import { zodTextFormat } from "openai/helpers/zod";
import {
  getDocument,
  GlobalWorkerOptions,
  VerbosityLevel,
} from "pdfjs-dist/legacy/build/pdf.mjs";

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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxImportedFileBytes = 12 * 1024 * 1024;
const maxImportedTextChars = 50000;

let pdfWorkerDataUrl: string | null = null;

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
  try {
    const body = await parseImportRequest(request);
    const env = getServerEnv();

    if (env.AI_MOCK_MODE) {
      return Response.json(mockImportProfile(body));
    }

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
      return jsonError("プロフィール下書きの解析に失敗しました", 502);
    }

    return Response.json(response.output_parsed);
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
