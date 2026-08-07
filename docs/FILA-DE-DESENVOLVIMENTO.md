# Fila de desenvolvimento — 360social

## Contato rápido da equipe por WhatsApp

**Estado:** implementado na versão 1.5.0; publicação e homologação em produção pendentes.

- Exibir na lista geral de **Equipe e Acessos** um ícone de WhatsApp ao lado de cada integrante que
  possua celular cadastrado.
- O atalho deve abrir `wa.me` com o número normalizado para o padrão internacional, sem espaços,
  máscara ou pontuação.
- O ícone não aparece quando o número estiver ausente ou inválido; a interface deve oferecer edição
  do cadastro aos papéis autorizados.
- O servidor continua sendo a fonte da permissão: somente papéis que já podem consultar o telefone
  da equipe recebem esse dado. Esconder o ícone não substitui RLS ou autorização da API.
- Incluir rótulo acessível, alvo de toque adequado para celular/tablet e abertura em nova aba sem
  perder o estado da tela.
- Homologar no desktop, PWA Android e iOS, incluindo números brasileiros com e sem o código do país.

## Sincronização segura do e-mail de acesso

**Estado:** implementado na versão 1.5.0; publicação e homologação em produção pendentes.

- Ao alterar o e-mail de uma pessoa com acesso, sincronizar a ficha `social.equipe` e a identidade
  correspondente em `auth.users`; nunca exibir sucesso quando apenas um dos registros foi alterado.
- Exigir permissão administrativa, confirmação explícita do novo endereço e auditoria com autor,
  data/hora, e-mail anterior e resultado, sem armazenar tokens de confirmação.
- Enquanto a confirmação estiver pendente, o e-mail anterior continua sendo o endereço de login e de
  recuperação; o novo endereço deve aparecer como pendente, não como efetivado.
- Se uma etapa falhar, manter o estado anterior ou sinalizar claramente a reconciliação necessária,
  evitando duas identidades contraditórias.
