create index if not exists audit_actor_name_trgm on mis.audit_log using gin(actor_name gin_trgm_ops);
create index if not exists audit_target_name_trgm on mis.audit_log using gin(target_name gin_trgm_ops);
