import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "この機能は現在利用できません。" },
    { status: 410 },
  );
}
