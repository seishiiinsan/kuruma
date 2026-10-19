import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Everything the game stores about the signed-in player, as a JSON download (GDPR). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Connecte-toi pour exporter tes données." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    return Response.json({ error: "L'export a échoué. Réessaie plus tard." }, { status: 500 });
  }

  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kuruma-mes-donnees-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
