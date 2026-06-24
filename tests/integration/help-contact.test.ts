import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendContactEmail: vi.fn(),
}));

vi.mock("@/lib/help/contact-email", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/help/contact-email")>();
  return {
    ...actual,
    sendContactEmail: mocks.sendContactEmail,
  };
});

import { POST } from "@/app/api/help/contact/route";

const validBody = {
  name: "表 紘太朗",
  email: "sender@example.com",
  category: "bug",
  subject: "送信テスト",
  message: "問い合わせフォームの送信テストです。",
  company: "",
};

describe("help contact route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    process.env.HELP_CONTACT_FROM_EMAIL = "Yell for You <support@example.com>";
    process.env.HELP_CONTACT_TO_EMAIL = "owner@example.com";
  });

  it("sends a contact email without exposing the recipient in the request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/help/contact", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "user-agent": "vitest",
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sendContactEmail).toHaveBeenCalledWith({
      name: "表 紘太朗",
      email: "sender@example.com",
      category: "不具合",
      subject: "送信テスト",
      message: "問い合わせフォームの送信テストです。",
      userAgent: "vitest",
    });
  });

  it("fails closed when email delivery env vars are missing", async () => {
    delete process.env.HELP_CONTACT_TO_EMAIL;

    const response = await POST(
      new Request("http://localhost/api/help/contact", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.11",
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.sendContactEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid input before sending email", async () => {
    const response = await POST(
      new Request("http://localhost/api/help/contact", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.12",
        },
        body: JSON.stringify({
          ...validBody,
          email: "not-an-email",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sendContactEmail).not.toHaveBeenCalled();
  });

  it("silently accepts honeypot submissions without sending email", async () => {
    const response = await POST(
      new Request("http://localhost/api/help/contact", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.13",
        },
        body: JSON.stringify({
          ...validBody,
          company: "bot-filled-field",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sendContactEmail).not.toHaveBeenCalled();
  });
});
