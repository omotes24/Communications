import { z } from "zod";

import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  hasContactEmailConfig,
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

const categoryLabels = {
  billing: "課金・トークン",
  account: "アカウント",
  bug: "不具合",
  privacy: "プライバシー・削除",
  other: "その他",
} satisfies Record<z.infer<typeof contactRequestSchema>["category"], string>;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
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
    const parsed = contactRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
        400,
      );
    }

    const body = parsed.data;
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
    });

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toPublicError(error), 502);
  }
}
