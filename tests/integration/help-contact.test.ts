import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  sendContactEmail: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: (retryAfterSeconds: number) =>
    Response.json(
      { error: "rate limited" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    ),
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

function buildContactFormData(
  overrides: Partial<typeof validBody> = {},
  images: File[] = [],
): FormData {
  const body = { ...validBody, ...overrides };
  return {
    get(key: string) {
      return body[key as keyof typeof body] ?? null;
    },
    getAll(key: string) {
      return key === "images" ? images : [];
    },
  } as unknown as FormData;
}

function buildTestFile(
  bytes: Uint8Array | string,
  name: string,
  type: string,
): File {
  const data =
    typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return {
    name,
    type,
    size: data.byteLength,
    arrayBuffer: async () => data.buffer.slice(0) as ArrayBuffer,
  } as File;
}

function buildMultipartContactRequest(
  formData: FormData,
  headers: Record<string, string>,
): Request {
  const request = new Request("http://localhost/api/help/contact", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "multipart/form-data; boundary=vitest",
    },
  });
  Object.defineProperty(request, "formData", {
    value: vi.fn().mockResolvedValue(formData),
  });
  return request;
}

describe("help contact route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({ ok: true });
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

  it("uses Cloudflare's connecting IP before proxy fallback headers", async () => {
    const response = await POST(
      new Request("http://localhost/api/help/contact", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "198.51.100.25",
          "x-forwarded-for": "203.0.113.20, 203.0.113.21",
          "x-real-ip": "203.0.113.22",
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith({
      key: "help-contact:198.51.100.25",
      limit: 5,
      windowMs: 10 * 60_000,
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

  it("sends uploaded images as private email attachments", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const response = await POST(
      buildMultipartContactRequest(
        buildContactFormData({}, [
          buildTestFile(bytes, "screen shot.png", "image/png"),
        ]),
        {
          "x-forwarded-for": "203.0.113.14",
          "user-agent": "vitest",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: "screen_shot.png",
            content: Buffer.from(bytes).toString("base64"),
          },
        ],
      }),
    );
  });

  it("rejects unsupported attachments before sending email", async () => {
    const response = await POST(
      buildMultipartContactRequest(
        buildContactFormData({}, [
          buildTestFile("bad", "notes.txt", "text/plain"),
        ]),
        {
          "x-forwarded-for": "203.0.113.15",
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.sendContactEmail).not.toHaveBeenCalled();
  });
});
