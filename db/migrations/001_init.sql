create extension if not exists citext; create extension if not exists pg_trgm;
create schema if not exists core; create schema if not exists mis;
create table mis.roles(id uuid primary key default gen_random_uuid(), name citext not null unique, description text, is_system boolean not null default false,
  status text not null default 'active' check(status in('active','inactive')), created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table mis.staff(id uuid primary key default gen_random_uuid(), employee_code text not null unique, name text not null, email citext not null unique, mobile text,
  password_hash text not null, role_id uuid references mis.roles(id) on delete restrict, reports_to_id uuid references mis.staff(id),
  status text not null default 'invited' check(status in('invited','active','suspended','deactivated')), is_super boolean not null default false,
  must_change_password boolean not null default true, failed_attempts int not null default 0, locked_until timestamptz, perm_version int not null default 1,
  last_login_at timestamptz, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(is_super or role_id is not null));
create index on mis.staff(role_id); create index on mis.staff(status);
create table mis.modules(key text primary key, name text not null, sort int not null default 0);
create table mis.permissions(key text primary key, module_key text not null references mis.modules(key) on delete cascade, label text not null, scope_capable boolean not null default false);
create table mis.role_permissions(role_id uuid not null references mis.roles(id) on delete cascade, permission_key text not null references mis.permissions(key) on delete cascade,
  data_scope text not null default 'all' check(data_scope in('own','all')), primary key(role_id,permission_key));
create table mis.sessions(id_hash text primary key, staff_id uuid not null references mis.staff(id) on delete cascade, created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(), expires_at timestamptz not null, ip text, user_agent text);
create index on mis.sessions(staff_id);
create table mis.audit_log(id bigserial primary key, at timestamptz not null default now(), actor_staff_id uuid, action text not null, entity text, entity_id text, detail jsonb, ip text);
create index on mis.audit_log(at); create index on mis.audit_log(entity, entity_id);
create function mis.audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_no_change before update or delete on mis.audit_log for each row execute function mis.audit_immutable();
create table core.tenants(id uuid primary key default gen_random_uuid(), name text not null, legal_name text, tax_id text, industry text, contact_name text not null, contact_email citext,
  contact_phone text, address text, country char(2) not null, base_currency char(3) not null,
  status text not null default 'onboarding' check(status in('onboarding','active','on_hold','closed')),
  created_by_staff_id uuid not null references mis.staff(id), owner_staff_id uuid not null references mis.staff(id),
  version int not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index tenants_tax_id_uq on core.tenants(upper(tax_id)) where tax_id is not null;
create index on core.tenants(owner_staff_id, status); create index tenants_name_trgm on core.tenants using gin(name gin_trgm_ops);
create table mis.client_assignments(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references core.tenants(id), staff_id uuid not null references mis.staff(id),
  assigned_by uuid references mis.staff(id), assigned_at timestamptz not null default now(), ended_at timestamptz, reason text);
create unique index one_open_assignment on mis.client_assignments(tenant_id) where ended_at is null;
