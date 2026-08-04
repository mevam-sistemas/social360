# Histórico de versões

Este projeto usa versionamento semântico: `MAIOR.MENOR.CORREÇÃO`.

## 1.4.2 — 2026-08-04

- A governança do banco compartilhado passa a apontar o CT360 como fonte canônica das 44 migrações alinhadas.
- Quinze versões já comprovadas no banco foram incorporadas ao histórico remoto sem reexecutar SQL ou alterar dados.
- Este repositório deixa de ser origem autorizada para `supabase db push`, evitando divergência entre produtos.

## 1.4.1 — 2026-08-04

- A configuração de e-mail deixa de oferecer um endereço de envio fictício; o remetente técnico é informado como gerenciado pela Arbor Labs.
- Automações de e-mail ainda não implantadas passam a aparecer como planejadas e desabilitadas, sem sugerir que estão enviando mensagens.
- Validação automatizada passa a conferir versão, PWA, autenticação, recursos críticos e ausência de segredos de servidor no cliente.
- Registro operacional atualizado com a confirmação do acesso presidencial e as evidências mais recentes de backup e restauração.

## 1.4.0 — 2026-08-04

- Data de nascimento disponível no cadastro da equipe.
- Felicitação cristã e afetiva de aniversário por e-mail, com versículo e controle anual contra duplicidade.
- Rodapé passa a ler a versão diretamente do mesmo arquivo usado pelo cache do PWA.

## 1.3.0 — 2026-08-04

- Versão do rodapé e cache do PWA passam a ler uma única fonte publicada.
- Presidência pode alternar pontos de vista sem alterar as permissões reais.
- Equipe aceita múltiplas funções e novos cargos operacionais.
- Cadastro de pessoas pode gerar carteirinha com QR code.
- Melhorias de permissões, fotos, navegação e acompanhamento institucional.

## 1.2.1 — 2026-08-03

- Convite automático e seguro ao conceder acesso para uma pessoa da equipe.
- Vínculo da conta de autenticação com a ficha existente, sem criar outra instituição.
- Troca de e-mail revoga o vínculo anterior antes de convidar a nova credencial.
- Links de convite abrem a definição de senha dentro do 360social.

## 1.2.0 — 2026-08-03

- Central regulatória pública com Termos de Uso, Aviso de Privacidade, tecnologias necessárias e retenção.
- Identificação e canais do fornecedor conforme as regras aplicáveis ao comércio eletrônico.
- Ciência versionada dos documentos legais na criação de novas contas.
- Links permanentes para a documentação no site e na entrada do portal.

## 1.1.1 — 2026-08-03

- Backup independente diário e manual do PostgreSQL e do Supabase Storage.
- Pacote compactado e cifrado antes do envio ao bucket privado Cloudflare R2.
- Retenção automática de 7 cópias diárias, 4 semanais e 6 mensais.
- Usuário PostgreSQL somente leitura e credencial R2 limitada a um único bucket.
- Procedimento documentado de verificação e restauração trimestral.

## 1.1.0 — 2026-08-03

- Navegação “Voltar” consistente, com descarte de rascunhos e mídias não publicados.
- Gravação de áudio nas orientações e histórico individual de audição.
- Fotos privadas de integrantes da equipe.
- Melhorias de foco, alvos de toque, movimento reduzido e textos alternativos.
- Senha mínima de 10 caracteres nos novos cadastros e redefinições.

## 1.0.0 — 2026-08-03

- Primeira versão operacional do portal SaaS em produção.
- Cadastro de pessoas, atendimentos, presença, doações, relatórios e administração institucional.
- PWA instalável com atualização controlada.
