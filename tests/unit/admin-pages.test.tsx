import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock("@/components/admin/AdminDashboard", () => ({
  AdminDashboard: () => <p>owner overview</p>,
}));

vi.mock("@/components/admin/AdminAnalyticsDashboard", () => ({
  AdminAnalyticsDashboard: () => <p>owner analytics</p>,
}));

import AdminAnalyticsPage from "@/app/admin/analytics/page";
import AdminPage from "@/app/admin/page";

const ownerId = "12345678-1234-4abc-8def-1234567890ab";

describe("owner-only administrator pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_USER_IDS = ownerId;
    delete process.env.XYZ_KEY;
    mocks.getCurrentUser.mockResolvedValue(null);
  });

  it.each([
    ["overview", AdminPage],
    ["analytics", AdminAnalyticsPage],
  ])(
    "shows only the fixed denial on the %s page for non-owners",
    async (_, page) => {
      process.env.XYZ_KEY = "fake-key";
      mocks.getCurrentUser.mockResolvedValue({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        email: "kotaro3150@keio.jp",
        source: "supabase",
      });

      render(await page());

      expect(screen.getByRole("alert")).toHaveTextContent(
        "XYZキーが必要です。",
      );
      expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/owner (overview|analytics)/),
      ).not.toBeInTheDocument();
    },
  );

  it("renders both management pages only for the owner Supabase session", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: ownerId,
      email: "kotaro3150@keio.jp",
      source: "supabase",
    });

    const overview = render(await AdminPage());
    expect(screen.getByText("owner overview")).toBeInTheDocument();
    overview.unmount();

    render(await AdminAnalyticsPage());
    expect(screen.getByText("owner analytics")).toBeInTheDocument();
    expect(screen.queryByText("XYZキーが必要です。")).not.toBeInTheDocument();
  });
});
