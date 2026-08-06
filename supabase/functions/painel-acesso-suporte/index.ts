import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODOX_AUTH_URL = Deno.env.get("MODOX_AUTH_URL")!;
const MODOX_ANON_KEY = Deno.env.get("MODOX_ANON_KEY")!;
const SUPORTE_EMAIL = "israel.koche@gmail.com";
const ORIGEM = "https://painel.arborlabs.com.br";

const cors = {
  "Access-Control-Allow-Origin": ORIGEM,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};
const resposta = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function validarSuporte(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${MODOX_AUTH_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: MODOX_ANON_KEY },
  });
  if (!r.ok) return false;
  const user = await r.json();
  return String(user?.email || "").toLowerCase() === SUPORTE_EMAIL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ error: "método não permitido" }, 405);

  try {
    if (!(await validarSuporte(req))) return resposta({ error: "sem permissão" }, 403);
    const body = await req.json();
    const acao = String(body?.acao || "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (acao === "dados") {
      const [{ data: instituicoes, error: ei }, { data: planos, error: ep }, { data: pessoas, error: epe }] = await Promise.all([
        admin.schema("social").from("instituicoes").select("id,nome,email,telefone,plano,trial_expira_em,limite_pessoas"),
        admin.schema("social").from("plano_instituicao").select("instituicao_id,status,ativa_ate"),
        admin.schema("social").from("pessoas").select("instituicao_id,arquivada"),
      ]);
      if (ei || ep || epe) throw ei || ep || epe;
      const agora = Date.now();
      const contagem = new Map<string, number>();
      for (const pessoa of pessoas || []) if (!pessoa.arquivada) {
        contagem.set(pessoa.instituicao_id, (contagem.get(pessoa.instituicao_id) || 0) + 1);
      }
      const porInstituicao = new Map((planos || []).map((p) => [p.instituicao_id, p]));
      const lista = (instituicoes || []).map((i) => {
        const p = porInstituicao.get(i.id);
        const trial = i.trial_expira_em ? new Date(i.trial_expira_em).getTime() : 0;
        const status = p?.status === "ativa" ? "pagando"
          : p?.status === "atrasada" || (trial && trial <= agora) ? "vencido"
          : trial > agora ? "trial" : "sem_info";
        const ativos = contagem.get(i.id) || 0;
        return {
          nome: i.nome,
          email: i.email,
          telefone: i.telefone,
          status,
          uso_percentual: i.limite_pessoas ? Math.round((ativos / i.limite_pessoas) * 1000) / 10 : null,
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const resumo = {
        total_contas: lista.length,
        pagando: lista.filter((i) => i.status === "pagando").length,
        trial_ativo: lista.filter((i) => i.status === "trial").length,
        trial_vencido: lista.filter((i) => i.status === "vencido").length,
      };
      return resposta({ resumo, lista });
    }

    if (acao === "acesso") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return resposta({ error: "e-mail inválido" }, 400);
      }
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://app.360social.com.br" },
      });
      if (error) throw error;
      console.info(JSON.stringify({ evento: "acesso_suporte_gerado", produto: "360social", por: SUPORTE_EMAIL }));
      return resposta({ link: data.properties?.action_link || null });
    }

    return resposta({ error: "ação inválida" }, 400);
  } catch (error) {
    console.error("painel-acesso-suporte", error);
    return resposta({ error: "não foi possível concluir a operação" }, 400);
  }
});
