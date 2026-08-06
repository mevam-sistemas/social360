# Histórico de versões

Este projeto usa versionamento semântico: `MAIOR.MENOR.CORREÇÃO`.

## 1.4.13 — 2026-08-06

- Login, cadastro e recuperação recebem uma nova identidade de cache, fazendo a semântica acessível chegar imediatamente também a sessões que estavam abertas.
- O release passa a impedir que a página e o shell PWA apontem para versões diferentes do arquivo de integração.

## 1.4.12 — 2026-08-06

- Entrada, recuperação de senha e criação de conta passam a anunciar corretamente o contexto de diálogo.
- O conteúdo ao fundo fica fora do teclado enquanto um diálogo estiver aberto; a tecla Escape fecha a camada e devolve a navegação.

## 1.4.11 — 2026-08-06

- O painel protegido deixa de participar da navegação por teclado e da árvore assistiva enquanto a tela de entrada estiver aberta.
- Após a autenticação, o painel é reabilitado integralmente para teclado e leitores de tela.

## 1.4.10 — 2026-08-06

- A tela inicial oculta o painel protegido também das tecnologias assistivas até a sessão ser confirmada.
- Busca principal e regiões da página ganham estrutura semântica para leitores de tela.
- Links legais passam a respeitar área mínima de toque em celular e tablet.
- A aplicação deixa de aceitar incorporação em páginas de terceiros, reduzindo risco de clickjacking.

## 1.4.9 — 2026-08-06

- A assinatura institucional e seu webhook passam a operar exclusivamente no ambiente do 360social.
- O retorno de pagamento aceita somente o endereço secreto entregue ao provedor e confirma os dados na API antes de alterar o plano.
- O antigo webhook compartilhado com o Modox deixa de ser necessário para novas assinaturas sociais.

## 1.4.8 — 2026-08-06

- A marca institucional usada como ação de início passa a respeitar alvo de toque de 44 px no desktop, tablet e celular.

## 1.4.7 — 2026-08-06

- Aniversários passam a operar inteiramente na base exclusiva do 360social, com histórico próprio contra duplicidade.
- A rotina diária usa SMTP protegido e linguagem específica para equipe e pessoas atendidas.
- O Modox deixa de participar da consulta ou do envio de aniversários sociais.

## 1.4.6 — 2026-08-06

- Produção passa a usar um projeto Supabase exclusivo do 360social, sem compartilhar autenticação, dados ou arquivos com o Modox.
- Autenticação fica restrita ao domínio oficial, exige ao menos 10 caracteres e verifica senhas conhecidas em vazamentos.
- Convites e notificações push são publicados no novo ambiente, com origem restrita e autorização explícita do autor da orientação.
- Chaves de push são renovadas para o ambiente dedicado; dispositivos já inscritos podem ativar novamente as notificações pelo aplicativo.

## 1.4.5 — 2026-08-06

- Navegação lateral, ações compactas, rodapé e aviso de atualização passam a respeitar alvos de toque de 44 px.
- Auditoria de segurança identifica e inicia a retirada do acoplamento histórico com o banco do Modox.
- Backup completo e cifrado executado antes da separação dos projetos Supabase.

## 1.4.4 — 2026-08-05

- A lista da equipe agora tem busca e paginação de 12 pessoas por vez.
- A consulta inicial da equipe transfere somente os campos necessários, reduzindo o peso da abertura.

## 1.4.3 — 2026-08-04

- Recuperação e confirmação passam a usar o endereço canônico do 360social, sem depender do domínio aberto no navegador.
- E-mails de acesso recebem assunto, linguagem e identidade próprios do produto e deixam de herdar conteúdo do Modox.

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
