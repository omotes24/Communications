import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeTranscription } from "@/components/audio/use-realtime-transcription";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createLiveStream(): MediaStream {
  const track = {
    readyState: "live",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe("useRealtimeTranscription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renews token reservations without ending an active transcription", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        jsonResponse({
          value: "mock-ephemeral-token",
          model: "mock",
          provider: "openai",
          reservationSeconds: 2,
        }),
      );
    const stream = createLiveStream();
    const { result, unmount } = renderHook(() => useRealtimeTranscription());

    await act(async () => {
      await result.current.start(stream, "remote", {
        transcriptionDelay: "xhigh",
      });
    });

    expect(result.current.status).toBe("live");
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      transcriptionDelay: "xhigh",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      transcriptionDelay: "xhigh",
    });
    expect(result.current.status).toBe("live");
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.stop({ stopTracks: false });
    });
    unmount();
  });
});
