// The OpenNext worker is generated before Wrangler bundles this entry point.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Generated build artifact; it does not exist before the OpenNext build.
import nextWorker from "./.open-next/worker.js";

type CloudflareWorkerEnv = {
  CRON_SECRET?: string;
  [key: string]: unknown;
};

type CloudflareExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

const worker = nextWorker as {
  fetch(
    request: Request,
    env: CloudflareWorkerEnv,
    context: CloudflareExecutionContext,
  ): Promise<Response>;
};

const cloudflareWorker = {
  fetch: worker.fetch,

  async scheduled(
    _controller: unknown,
    env: CloudflareWorkerEnv,
    context: CloudflareExecutionContext,
  ): Promise<void> {
    const secret = env.CRON_SECRET?.trim();
    if (!secret) {
      throw new Error(
        "CRON_SECRET is required for reservation reconciliation.",
      );
    }

    const response = await worker.fetch(
      new Request(
        "https://yell-for-you.internal/api/admin/reconcile-token-reservations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: 100 }),
        },
      ),
      env,
      context,
    );

    if (!response.ok) {
      throw new Error(
        `Reservation reconciliation failed with HTTP ${response.status}.`,
      );
    }
  },
};

export default cloudflareWorker;
