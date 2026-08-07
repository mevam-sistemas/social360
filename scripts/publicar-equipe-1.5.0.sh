#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_REF="qimjttthnvmyjeqqopbf"
CLI="${REPO_DIR}/../ct360/node_modules/.bin/supabase"

cd "$REPO_DIR"

if [[ ! -x "$CLI" ]]; then
  echo "Supabase CLI local não encontrado em: $CLI" >&2
  exit 1
fi

linked_ref="$(tr -d '[:space:]' < supabase/.temp/project-ref 2>/dev/null || true)"
if [[ "$linked_ref" != "$PROJECT_REF" ]]; then
  echo "Publicação interrompida: este repositório não está ligado ao banco do 360social." >&2
  echo "Esperado: $PROJECT_REF" >&2
  echo "Encontrado: ${linked_ref:-nenhum}" >&2
  exit 1
fi

echo "Projeto confirmado: 360social ($PROJECT_REF)"
echo "Enviando a correção dos repositórios..."
git -C "${REPO_DIR}/../ct360" push origin marco-zero
git -C "$REPO_DIR" push origin main

echo "Publicando a migração do telefone, auditoria e exportações..."
"$CLI" db push --include-all

echo "Publicando a sincronização segura de e-mail..."
"$CLI" functions deploy atualizar-email-equipe --project-ref "$PROJECT_REF"

echo "Publicação do 360social 1.5.0 concluída."
