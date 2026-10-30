alter table mis.audit_log add column actor_name text;
alter table mis.audit_log add column target_name text;

alter table mis.audit_log disable trigger audit_no_change;
update mis.audit_log a
set actor_name=s.name
from mis.staff s
where a.actor_staff_id=s.id and a.actor_name is null;

update mis.audit_log
set target_name=detail->>'name'
where target_name is null and detail ? 'name';
alter table mis.audit_log enable trigger audit_no_change;

create index audit_actor_at_idx on mis.audit_log(actor_staff_id,at desc);
