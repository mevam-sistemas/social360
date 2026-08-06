import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sw = read('web/sw.js');
const app = read('web/index.html');
const bridge = read('web/ponte-banco.js');
const manifest = JSON.parse(read('web/manifest.json'));
const changelog = read('CHANGELOG.md');
const pkg = JSON.parse(read('package.json'));
const securityMigration = read('supabase/migrations/20260806102000_restringir_anonimo_social.sql');
const headers = read('web/_headers');

const version = sw.match(/SOCIAL360_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert(version, 'SOCIAL360_VERSION ausente do service worker');
assert(pkg.version === version, `package.json (${pkg.version}) e PWA (${version}) divergem`);
assert(changelog.includes(`## ${version} —`), `CHANGELOG não registra ${version}`);

for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  assert(manifest[field], `manifest.json sem ${field}`);
}
for (const icon of manifest.icons) {
  assert(existsSync(new URL(`web/${icon.src}`, root)), `ícone PWA inexistente: ${icon.src}`);
}
for (const asset of [...sw.matchAll(/['"](\/[A-Za-z0-9._/?=-]+)['"]/g)].map(m => m[1])) {
  const clean = asset.split('?')[0];
  if (clean === '/') continue;
  assert(existsSync(new URL(`web${clean}`, root)), `asset do shell inexistente: ${asset}`);
}

for (const contract of [
  'signInWithPassword', 'resetPasswordForEmail', 'PASSWORD_RECOVERY',
  'Estoque atual', 'Carteirinha', 'Assistente Social', 'Local de armazenamento',
  'ativarNotificacoesPush', 'MediaRecorder'
]) {
  assert(app.includes(contract) || bridge.includes(contract) || read('web/pwa.js').includes(contract), `recurso crítico ausente: ${contract}`);
}
assert(bridge.includes("redirectTo: 'https://app.360social.com.br'"), 'recuperação não retorna ao 360social');
assert(bridge.includes("emailRedirectTo: 'https://app.360social.com.br'"), 'cadastro não retorna ao 360social');
assert(!app.includes('id="em-end"'), 'endereço de remetente fictício voltou a ser editável');
assert(!app.includes('onclick="salvarEmail()"'), 'configuração de envio sem efeito voltou à interface');
assert(app.includes('planejado, ainda não envia e-mail'), 'automações futuras não estão identificadas com transparência');
assert(securityMigration.includes('revoke all on function %s from public, anon'), 'RPCs sociais não revogam acesso anônimo');
assert(securityMigration.includes('revoke usage on schema social from anon'), 'schema social ainda pode ser usado por anon');
assert(app.includes('.bt.pq{font-size:13px;padding:8px 12px;min-height:44px}'), 'ações compactas não respeitam alvo de toque');
assert(app.includes('class="app" aria-hidden="true" inert'), 'conteúdo protegido continua navegável antes da autenticação');
assert(bridge.includes("app.removeAttribute('aria-hidden')"), 'conteúdo autenticado não é reabilitado após a sessão');
assert(bridge.includes("app.removeAttribute('inert')"), 'conteúdo autenticado permanece inerte após a sessão');
assert(app.includes('for="q0"'), 'busca principal não possui rótulo semântico');
assert(app.includes('.boas-legal a{display:inline-flex;align-items:center;min-height:44px'), 'links legais não respeitam alvo de toque');
assert(app.includes('<main class="obra"'), 'aplicação não declara sua região principal');
assert(app.includes('function associarRotulos(root=document)'), 'campos dinâmicos não recebem associação semântica de rótulos');
assert(bridge.includes("painel?.setAttribute('aria-modal','true')"), 'modais não declaram contexto acessível');
assert(bridge.includes("event.key === 'Escape'"), 'modais não podem ser fechados pelo teclado');
assert(headers.includes('X-Frame-Options: DENY'), 'aplicação ainda aceita enquadramento por terceiros');
assert(headers.includes("frame-ancestors 'none'"), 'CSP ainda permite clickjacking');

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
for (const file of [...walk(new URL('web/', root).pathname), ...walk(new URL('site/', root).pathname)]) {
  const text = readFileSync(file, 'utf8');
  for (const forbidden of ['SUPABASE_SERVICE_ROLE_KEY', 'BEGIN PRIVATE KEY', 'VAPID_PRIVATE_KEY', 'BREVO_API_KEY']) {
    assert(!text.includes(forbidden), `${forbidden} exposto em ${relative(new URL('.', root).pathname, file)}`);
  }
}

for (const [arquivo, limite] of [['web/index.html', 350_000], ['web/ponte-banco.js', 110_000], ['web/supabase.min.js', 250_000]]) {
  const tamanho = statSync(new URL(arquivo, root)).size;
  assert(tamanho <= limite, `${arquivo} excedeu o orçamento de desempenho: ${tamanho} > ${limite}`);
}

console.log(`360social ${version}: validações de release aprovadas.`);
