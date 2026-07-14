import "server-only";

import { z } from "zod";

const contactEmailEnvSchema = z.object({
  HELP_CONTACT_TO_EMAIL: z.string().trim().email(),
  HELP_CONTACT_FROM_EMAIL: z.string().trim().min(3),
  RESEND_API_KEY: z.string().trim().min(1),
});

export type ContactEmailInput = {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  userAgent?: string | null;
  attachments?: ContactEmailAttachment[];
};

export type ContactEmailAttachment = {
  filename: string;
  content: string;
};

export function hasContactEmailConfig(): boolean {
  return contactEmailEnvSchema.safeParse(process.env).success;
}

function getContactEmailConfig() {
  return contactEmailEnvSchema.parse(process.env);
}

function buildContactEmailText(input: ContactEmailInput): string {
  const attachmentLines = input.attachments?.length
    ? [
        "",
        "添付画像:",
        ...input.attachments.map((attachment) => `- ${attachment.filename}`),
      ]
    : [];

  return [
    "Yell for You 1.3 問い合わせ",
    "",
    `名前: ${input.name}`,
    `返信先: ${input.email}`,
    `種別: ${input.category}`,
    `件名: ${input.subject}`,
    `User-Agent: ${input.userAgent || "未取得"}`,
    "",
    "本文:",
    input.message,
    ...attachmentLines,
  ].join("\n");
}

export async function sendContactEmail(
  input: ContactEmailInput,
): Promise<void> {
  const config = getContactEmailConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.HELP_CONTACT_FROM_EMAIL,
      to: [config.HELP_CONTACT_TO_EMAIL],
      reply_to: input.email,
      subject: `[Yell for You] ${input.subject}`,
      text: buildContactEmailText(input),
      attachments: input.attachments,
      tags: [
        {
          name: "source",
          value: "help_contact",
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Contact email delivery failed: ${response.status}`);
  }
}
