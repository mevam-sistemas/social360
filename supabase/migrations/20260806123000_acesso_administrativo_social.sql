-- O service_role é usado somente nas Edge Functions e rotinas de backup.
-- O papel continua fora do navegador, mas precisa dos privilégios SQL para
-- que o PostgREST administrativo consiga operar o schema dedicado.
grant usage on schema social to service_role;
grant all privileges on all tables in schema social to service_role;
grant all privileges on all sequences in schema social to service_role;
grant execute on all functions in schema social to service_role;

alter default privileges in schema social
  grant all privileges on tables to service_role;
alter default privileges in schema social
  grant all privileges on sequences to service_role;
alter default privileges in schema social
  grant execute on functions to service_role;
