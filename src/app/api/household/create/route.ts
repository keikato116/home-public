import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: household, error: hError } = await supabase
    .from("households")
    .insert({ name: "home" })
    .select()
    .single();

  if (hError || !household) {
    return NextResponse.json({ error: hError?.message }, { status: 500 });
  }

  const { error: mError } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id });

  if (mError) {
    return NextResponse.json({ error: mError.message }, { status: 500 });
  }

  await supabase
    .from("calendar_settings")
    .insert({ household_id: household.id, selected_colors: [], start_date: new Date().toISOString().split("T")[0] });

  return NextResponse.json({
    household_id: household.id,
    invite_code: household.invite_code,
  });
}
