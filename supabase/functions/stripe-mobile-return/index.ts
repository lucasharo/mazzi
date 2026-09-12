// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Cache-Control": "no-store",
};

Deno.serve((request: Request) => {
  const url = new URL(request.url);
  const target = new URL("mazzi://stripe-return");
  for (const [key, value] of url.searchParams.entries()) target.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: { ...headers, Location: target.toString() },
  });
});
