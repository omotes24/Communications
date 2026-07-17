import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileExpiredTokenReservations: vi.fn(),
}));

vi.mock("@/lib/tokens/service", () => ({
  reconcileExpiredTokenReservations: mocks.reconcileExpiredTokenReservations,
}));

import { GET, POST } from "@/app/api/admin/reconcile-token-reservations/route";

describe("expired reservation reconciliation cron auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL_CRON_SECRET;
    mocks.reconcileExpiredTokenReservations.mockResolvedValue({
      released: 0,
    });
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    process.env.VERCEL_CRON_SECRET = "legacy-secret";

    const response = await GET(
      new Request("http://localhost/api/admin/reconcile-token-reservations", {
        headers: {
          Authorization: "Bearer legacy-secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.reconcileExpiredTokenReservations).not.toHaveBeenCalled();
  });

  it("accepts the Vercel Cron GET Authorization bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret-value";
    mocks.reconcileExpiredTokenReservations.mockResolvedValue({
      released: 1,
      reservations: [
        {
          request_id: "private-request-id",
          user_id: "private-user-id",
          released_amount: 100,
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/admin/reconcile-token-reservations", {
        headers: {
          Authorization: "Bearer cron-secret-value",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reconcileExpiredTokenReservations).toHaveBeenCalledWith(100);
    expect(await response.json()).toEqual({ released: 1 });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
  });

  it("accepts protected manual POST execution with a limit", async () => {
    process.env.CRON_SECRET = "cron-secret-value";

    const response = await POST(
      new Request("http://localhost/api/admin/reconcile-token-reservations", {
        method: "POST",
        headers: {
          Authorization: "Bearer cron-secret-value",
        },
        body: JSON.stringify({ limit: 7 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reconcileExpiredTokenReservations).toHaveBeenCalledWith(7);
  });

  it("rejects requests that only send the legacy x-cron-secret header", async () => {
    process.env.CRON_SECRET = "cron-secret-value";

    const response = await GET(
      new Request("http://localhost/api/admin/reconcile-token-reservations", {
        headers: {
          "x-cron-secret": "cron-secret-value",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.reconcileExpiredTokenReservations).not.toHaveBeenCalled();
  });

  it("rejects an incorrect bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret-value";

    const response = await GET(
      new Request("http://localhost/api/admin/reconcile-token-reservations", {
        headers: {
          Authorization: "Bearer wrong-secret-value",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.reconcileExpiredTokenReservations).not.toHaveBeenCalled();
  });
});
