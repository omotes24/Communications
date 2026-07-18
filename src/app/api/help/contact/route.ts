import { Buffer } from "node:buffer";

import { z } from "zod";

import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  hasContactEmailConfig,
  type ContactEmailAttachment,
  sendContactEmail,
} from "@/lib/help/contact-email";
import { jsonError, toPublicError } from "@/lib/privacy/logging";

export const dynamic = "force-dynamic";

const contactRequestSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください。").max(80),
  email: z
    .string()
    .trim()
    .email("返信先メールアドレスを正しく入力してください。")
    .max(160),
  category: z.enum(["billing", "account", "bug", "privacy", "other"]),
  subject: z.string().trim().min(1, "件名を入力してください。").max(120),
  message: z
    .string()
    .trim()
    .min(10, "本文は10文字以上で入力してください。")
    .max(2000),
  company: z.string().trim().max(200).optional().default(""),
});

const maxImageAttachments = 3;
const maxImageAttachmentBytes = 5 * 1024 * 1024;
const maxTotalImageAttachmentBytes = 12 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const imageExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as Record<string, string>;

const categoryLabels = {
  billing: "課金・トークン",
  account: "アカウント",
  bug: "不具合",
  privacy: "プライバシー・削除",
  other: "その他",
} satisfies Record<z.infer<typeof contactRequestSchema>["category"], string>;

class ContactAttachmentError extends Error {}

function getClientIp(request: Request): string {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) {
    return cloudflare;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isUploadedFile(entry: FormDataEntryValue): entry is File {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const candidate = entry as Partial<File>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.type === "string"
  );
}

function sanitizeAttachmentFilename(file: File, index: number): string {
  const extension = imageExtensions[file.type] ?? "png";
  const fallback = `image-${index + 1}.${extension}`;
  const sanitized = file.name
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  if (!sanitized) {
    return fallback;
  }
  return sanitized.includes(".") ? sanitized : `${sanitized}.${extension}`;
}

async function buildImageAttachments(
  files: File[],
): Promise<ContactEmailAttachment[]> {
  if (files.length > maxImageAttachments) {
    throw new ContactAttachmentError(
      `画像は${maxImageAttachments}枚まで添付できます。`,
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxTotalImageAttachmentBytes) {
    throw new ContactAttachmentError("添付画像の合計サイズが大きすぎます。");
  }

  return Promise.all(
    files.map(async (file, index) => {
      if (!supportedImageTypes.has(file.type)) {
        throw new ContactAttachmentError(
          "添付できる画像はPNG、JPEG、WebP、GIFです。",
        );
      }
      if (file.size > maxImageAttachmentBytes) {
        throw new ContactAttachmentError(
          "画像1枚のサイズは5MB以内にしてください。",
        );
      }

      return {
        filename: sanitizeAttachmentFilename(file, index),
        content: Buffer.from(await file.arrayBuffer()).toString("base64"),
      };
    }),
  );
}

async function parseContactRequest(request: Request): Promise<{
  body: z.infer<typeof contactRequestSchema>;
  attachments: ContactEmailAttachment[];
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const parsed = contactRequestSchema.safeParse({
      name: getFormString(formData, "name"),
      email: getFormString(formData, "email"),
      category: getFormString(formData, "category"),
      subject: getFormString(formData, "subject"),
      message: getFormString(formData, "message"),
      company: getFormString(formData, "company"),
    });
    if (!parsed.success) {
      throw parsed.error;
    }

    const imageFiles = formData
      .getAll("images")
      .filter(
        (entry): entry is File => isUploadedFile(entry) && entry.size > 0,
      );
    return {
      body: parsed.data,
      attachments: await buildImageAttachments(imageFiles),
    };
  }

  const parsed = contactRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw parsed.error;
  }
  return {
    body: parsed.data,
    attachments: [],
  };
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit({
    key: `help-contact:${getClientIp(request)}`,
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const { body, attachments } = await parseContactRequest(request);
    if (body.company) {
      return Response.json({ ok: true });
    }

    if (!hasContactEmailConfig()) {
      return jsonError("問い合わせ送信設定が不足しています。", 503);
    }

    await sendContactEmail({
      name: body.name,
      email: body.email,
      category: categoryLabels[body.category],
      subject: body.subject,
      message: body.message,
      userAgent: request.headers.get("user-agent"),
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "入力内容を確認してください。",
        400,
      );
    }
    if (error instanceof ContactAttachmentError) {
      return jsonError(error.message, 400);
    }
    return jsonError(toPublicError(error), 502);
  }
}
