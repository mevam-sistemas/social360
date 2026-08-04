-- Cargos descritivos disponíveis para a equipe. Eles não concedem permissões;
-- o acesso ao sistema continua sendo definido exclusivamente pelo papel.

-- Padroniza o cargo antigo sem quebrar os vínculos existentes da equipe.
update social.funcoes antiga
set nome = 'Aux. Cozinha'
where lower(antiga.nome) = lower('Auxiliar de cozinha')
  and not exists (
    select 1
    from social.funcoes atual
    where atual.instituicao_id = antiga.instituicao_id
      and lower(atual.nome) = lower('Aux. Cozinha')
  );

-- Cada instituição recebe as opções abaixo; a condição torna a migração
-- idempotente e preserva funções personalizadas já cadastradas.
insert into social.funcoes (id, instituicao_id, nome, ativa)
select gen_random_uuid(), i.id, cargo.nome, true
from social.instituicoes i
cross join (values
  ('Advogado'),
  ('Aux. Cozinha'),
  ('Aux. Limpeza'),
  ('Aux. Louça'),
  ('Barbeiro'),
  ('Cozinheiro'),
  ('Psicólogo'),
  ('Recepcionista')
) as cargo(nome)
where not exists (
  select 1
  from social.funcoes f
  where f.instituicao_id = i.id
    and lower(f.nome) = lower(cargo.nome)
);
