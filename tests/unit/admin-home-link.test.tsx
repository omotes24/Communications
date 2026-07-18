import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminUser: mocks.getAdminUser,
}));

import { AdminHomeLink } from "@/components/home/AdminHomeLink";

describe("administrator home link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the management button only to an administrator", async () => {
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
      source: "supabase",
    });

    render(await AdminHomeLink());

    expect(screen.getByRole("link", { name: "管理画面" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("renders nothing for a signed-out or ordinary user", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    const result = await AdminHomeLink();

    expect(result).toBeNull();
  });
});
