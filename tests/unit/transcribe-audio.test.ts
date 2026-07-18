import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/transcribe-audio/route";
import { resetTestTokenState } from "@/lib/tokens/service";

const testUserId = "00000000-0000-4000-8000-000000000099";
const maxAudioFileBytes = 12 * 1024 * 1024;

function buildAudioRequest(size: number): Request {
  const audio = new File(["audio"], "interview.webm", {
    type: "audio/webm",
  });
  Object.defineProperty(audio, "size", { value: size });

  const request = new Request("http://localhost/api/transcribe-audio", {
    method: "POST",
  });
  Object.defineProperty(request, "formData", {
    value: async () =>
      ({
        get: (key: string) => (key === "audio" ? audio : null),
      }) as FormData,
  });
  return request;
}

describe("transcribe audio route", () => {
  beforeEach(() => {
    process.env.AI_MOCK_MODE = "true";
    process.env.TEST_AUTH_USER_ID = testUserId;
    process.env.TOKEN_TEST_MODE = "true";
    resetTestTokenState(testUserId, 100000);
  });

  it("rejects audio larger than the 12MB upload ceiling before token use", async () => {
    resetTestTokenState(testUserId, 0);

    const response = await POST(buildAudioRequest(maxAudioFileBytes + 1));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "音声ファイルは12MB以下にしてください。",
    });
  });

  it("accepts audio at the 12MB upload ceiling", async () => {
    const response = await POST(buildAudioRequest(maxAudioFileBytes));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      text: expect.stringContaining("モックモード"),
    });
  });
});
