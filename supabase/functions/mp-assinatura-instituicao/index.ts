import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://app.360social.com.br";
const JSON_HEADERS = { "Content-Type": "application/json" };
const PLANOS: Record<string, { nome: string; preco: number }> = {
  inicio: { nome: "Início", preco: 149 },
  impacto: { nome: "Impacto", preco: 199 },
  rede: { nome: "Rede", preco: 299 },
};

function cors(req: Request) {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? origin : ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resposta(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), ...JSON_HEADERS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return resposta(req, 405, { error: "método não permitido" });
  if (req.headers.get("origin") && req.headers.get("origin") !== ORIGIN) {
    return resposta(req, 403, { error: "origem não permitida" });
  }

  try {
    const token = req.headers.get("authorization") ?? "";
    if (!token.startsWith("Bearer ")) return resposta(req, 401, { error: "sessão obrigatória" });

    const { plano } = await req.json();
    const escolhido = PLANOS[String(plano ?? "")];
    if (!escolhido) return resposta(req, 400, { error: "plano inválido" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: token } }, db: { schema: "social" } },
    );
    const { data: preparacao, error } = await supabase.rpc("iniciar_assinatura_instituicao", { p_plano: plano });
    if (error || !preparacao) return resposta(req, 403, { error: error?.message ?? "assinatura não autorizada" });

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    const webhookToken = Deno.env.get("MP_WEBHOOK_TOKEN");
    if (!mpToken || !webhookToken) return resposta(req, 503, { error: "pagamentos temporariamente indisponíveis" });

    const pagamento = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: `360social — Plano ${escolhido.nome} (${preparacao.nome_instituicao})`,
        external_reference: `inst_${plano}_${preparacao.instituicao_id}`,
        payer_email: preparacao.email_admin,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: escolhido.preco,
          currency_id: "BRL",
        },
        back_url: "https://app.360social.com.br/?mp=assinatura",
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook-instituicao?token=${encodeURIComponent(webhookToken)}`,
        status: "pending",
      }),
    });
    const resultado = await pagamento.json();
    if (!pagamento.ok) {
      console.error("Mercado Pago recusou preapproval", pagamento.status);
      return resposta(req, 502, { error: "não foi possível abrir o pagamento" });
    }

    const { error: registroErro } = await supabase.rpc("registrar_preapproval_instituicao", {
      p_mp_preapproval_id: String(resultado.id),
    });
    if (registroErro) return resposta(req, 500, { error: "pagamento criado, mas o vínculo não pôde ser salvo" });

    return resposta(req, 200, { id: resultado.id, init_point: resultado.init_point, status: resultado.status });
  } catch (error) {
    console.error(error);
    return resposta(req, 500, { error: "não foi possível iniciar a assinatura" });
  }
});
