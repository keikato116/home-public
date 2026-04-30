import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invite_code } = await request.json();
  if (!invite_code) {
    return NextResponse.json({ error: "invite_code required" }, { status: 400 });
  }

  const { data: household, error: hError } = await supabase
    .from("households")
    .select("id")
    .eq("invite_code", invite_code.trim().toUpperCase())
    .single();

  if (hError || !household) {
    return NextResponse.json({ error: "招待コードが見つかりません" }, { status: 404 });
  }

  const { error: mError } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id })
    .select()
    .single();

  if (mError && !mError.message.includes("duplicate")) {
    return NextResponse.json({ error: mError.message }, { status: 500 });
  }

  return NextResponse.json({ household_id: household.id });
}
