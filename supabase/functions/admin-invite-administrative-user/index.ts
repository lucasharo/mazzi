// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type AdministrativeRole = "PLATFORM_ADMIN" | "SUPPORT";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { message: "Sessão não encontrada." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !publishableKey || !serviceRoleKey) return reply(500, { message: "Serviço administrativo indisponível." });

  const sessionClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await sessionClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { message: "Sessão inválida ou expirada." });

  let payload: { email?: string; role?: AdministrativeRole };
  try { payload = await request.json(); } catch { return reply(400, { message: "Dados do convite inválidos." }); }
  const email = payload.email?.trim().toLowerCase() || "";
  const role = payload.role;
  if (!/^\S+@\S+\.\S+$/.test(email) || (role !== "PLATFORM_ADMIN" && role !== "SUPPORT")) {
    return reply(400, { message: "Informe um e-mail válido e um tipo de acesso permitido." });
  }

  const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: existingUser, error: existingError } = await service
    .from("users")
    .select("id")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingError) return reply(500, { message: "Não foi possível validar o usuário informado." });

  if (existingUser?.id) {
    const { data, error } = await service.rpc("admin_grant_administrative_role_from_server", {
      p_actor_id: authData.user.id, p_target_user_id: existingUser.id, p_role: role,
    });
    if (error) return reply(error.code === "42501" ? 403 : 400, { message: "Não foi possível conceder o acesso administrativo." });
    return reply(200, { outcome: "existing_user", result: data });
  }

  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    data: { name: "Usuário convidado" },
    redirectTo: Deno.env.get("MAZZI_ADMIN_INVITE_REDIRECT_URL"),
  });
  if (inviteError || !inviteData.user) return reply(400, { message: "Não foi possível enviar este convite agora." });

  const { data, error } = await service.rpc("admin_grant_administrative_role_from_server", {
    p_actor_id: authData.user.id, p_target_user_id: inviteData.user.id, p_role: role,
  });
  if (error) return reply(500, { message: "Convite criado, mas o acesso administrativo ainda não foi concluído." });
  return reply(201, { outcome: "invited_user", result: data });
});
