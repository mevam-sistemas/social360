# Fila de desenvolvimento — 360social

## Contato rápido da equipe por WhatsApp

**Estado:** planejado.

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

