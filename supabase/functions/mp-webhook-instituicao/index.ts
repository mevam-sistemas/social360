import { createClient } from "npm:@supabase/supabase-js@2";

const LIMITES: Record<string, number> = { inicio: 100, impacto: 500, rede: 1000 };

function identificador(url: URL, body: any) {
  return url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body?.data?.id ?? null;
}

async function buscar(path: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? await response.json() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const webhookToken = Deno.env.get("MP_WEBHOOK_TOKEN");
  if (!webhookToken) return new Response("service unavailable", { status: 503 });

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== webhookToken) return new Response("unauthorized", { status: 401 });
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) return new Response("service unavailable", { status: 503 });
    let body: any = null;
    try { body = await req.json(); } catch { /* notificações podem vir sem JSON */ }
    const topico = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? "";
    const id = identificador(url, body);
    if (!id || !["preapproval", "subscription_preapproval", "subscription_authorized_payment"].includes(topico)) {
      return new Response("ok");
    }

    const autorizado = topico === "subscription_authorized_payment"
      ? await buscar(`authorized_payments/${encodeURIComponent(id)}`, mpToken)
      : null;
    const preapprovalId = autorizado?.preapproval_id ?? id;
    const preapproval = await buscar(`preapproval/${encodeURIComponent(preapprovalId)}`, mpToken);
    const referencia = String(preapproval?.external_reference ?? "");
    if (!preapproval || !referencia.startsWith("inst_")) return new Response("ok");

    const [, plano, ...partesInstituicao] = referencia.split("_");
    const instituicaoId = partesInstituicao.join("_");
    if (!LIMITES[plano] || !/^[0-9a-f-]{36}$/i.test(instituicaoId)) return new Response("ok");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "social" } },
    );

    if (topico !== "subscription_authorized_payment") {
      if (preapproval.status === "cancelled") {
        await supabase.from("plano_instituicao").update({ status: "cancelada", atualizado_em: new Date().toISOString() })
          .eq("instituicao_id", instituicaoId).eq("mp_preapproval_id", String(preapproval.id));
        return new Response("ok");
      }
      if (preapproval.status !== "authorized") return new Response("ok");
    } else if (!(autorizado?.status === "processed" || autorizado?.payment?.status === "approved")) {
      return new Response("ok");
    }

    const marca = topico === "subscription_authorized_payment" ? `ap_${autorizado.id}` : `pre_${preapproval.id}`;
    const { data: existente } = await supabase.from("pagamentos_plano_instituicao").select("id").eq("mp_ref", marca).maybeSingle();
    if (existente) return new Response("ok");

    const { data: atual } = await supabase.from("plano_instituicao").select("ativa_ate")
      .eq("instituicao_id", instituicaoId).maybeSingle();
    const base = atual?.ativa_ate && new Date(atual.ativa_ate) > new Date() ? new Date(atual.ativa_ate) : new Date();
    base.setDate(base.getDate() + 30);

    const { error: planoErro } = await supabase.from("plano_instituicao").update({
      status: "ativa",
      mp_preapproval_id: String(preapproval.id),
      ativa_ate: base.toISOString(),
      atualizado_em: new Date().toISOString(),
    }).eq("instituicao_id", instituicaoId);
    if (planoErro) throw planoErro;

    const { error: pagamentoErro } = await supabase.from("pagamentos_plano_instituicao").insert({
      instituicao_id: instituicaoId,
      mp_ref: marca,
      plano,
      origem: topico === "subscription_authorized_payment" ? "assinatura/mensalidade" : "assinatura",
      valor: autorizado?.amount ?? preapproval.auto_recurring?.transaction_amount ?? null,
    });
    if (pagamentoErro) throw pagamentoErro;

    await supabase.from("instituicoes").update({ plano, limite_pessoas: LIMITES[plano] }).eq("id", instituicaoId);
    return new Response("ok");
  } catch (error) {
    console.error(error);
    return new Response("temporary failure", { status: 500 });
  }
});
