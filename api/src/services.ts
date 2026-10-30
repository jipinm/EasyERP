import {z} from 'zod';import type {Pool} from 'pg';import {AppError,notFound} from './errors';import {tx,isUnique} from './db';import {audit} from './audit';
import {hashPw,verifyPw,tempPassword,pwSchema,sha,newToken} from './security';import {MODULES} from './modules';import {type Principal,scopeOf} from './authz';import {auditSummary} from './audit';
const uuid=z.string().uuid();const id=(v:string)=>{if(!uuid.safeParse(v).success) throw notFound();return v};
const phone=z.string().trim().transform(s=>s.replace(/[\s()-]/g,'')).pipe(z.string().regex(/^\+?[0-9]{7,15}$/,'Enter a valid phone number'));
let dummy:Promise<string>|undefined;
/* ---------- auth ---------- */
export async function login(pool:Pool,body:unknown,ip?:string,ua?:string){
 const {email,password}=z.object({email:z.string().trim().email().max(200),password:z.string().min(1).max(128)}).parse(body);
 const {rows:[s]}=await pool.query('select id,password_hash,status,locked_until,must_change_password from mis.staff where email=$1',[email]);
 const ok=await verifyPw(s?.password_hash??await(dummy??=hashPw('not-a-real-password-1')),password).catch(()=>false);
 const locked=s?.locked_until&&s.locked_until>new Date();
 if(!s||locked||!ok||!['invited','active'].includes(s.status)){
  if(s&&!locked) await pool.query(`update mis.staff set failed_attempts=case when failed_attempts+1>=5 then 0 else failed_attempts+1 end,locked_until=case when failed_attempts+1>=5 then now()+interval '15 minutes' else locked_until end where id=$1`,[s.id]);
  await audit(pool,s?.id??null,'login.failure','staff',s?.id,{email},ip);
  throw new AppError(401,'INVALID_CREDENTIALS','Email or password is incorrect.');}
 const token=newToken();
 await pool.query('update mis.staff set failed_attempts=0,locked_until=null,last_login_at=now() where id=$1',[s.id]);
 await pool.query(`insert into mis.sessions(id_hash,staff_id,expires_at,ip,user_agent) values($1,$2,now()+interval '12 hours',$3,$4)`,[sha(token),s.id,ip??null,ua?.slice(0,300)??null]);
 await audit(pool,s.id,'login.success','staff',s.id,null,ip);
 return {token,mustChange:s.must_change_password};}
export async function changePassword(pool:Pool,p:Principal,keepHash:string,body:unknown,ip?:string){
 const {current,next,confirm}=z.object({current:z.string().max(128).optional(),next:pwSchema,confirm:pwSchema}).parse(body);
 if(next!==confirm) throw new AppError(422,'VALIDATION','New password and confirmation do not match.');
 if(!p.mustChange){
  if(!current) throw new AppError(422,'VALIDATION','Enter your current password.');
  const {rows:[s]}=await pool.query('select password_hash from mis.staff where id=$1',[p.id]);
  if(!await verifyPw(s.password_hash,current).catch(()=>false)) throw new AppError(422,'VALIDATION','Current password is incorrect.');
  if(current===next) throw new AppError(422,'VALIDATION','Choose a password different from the current one.');
 }
 await tx(pool,async c=>{await c.query(`update mis.staff set password_hash=$2,must_change_password=false,status='active',updated_at=now() where id=$1`,[p.id,await hashPw(next)]);
  await c.query('delete from mis.sessions where staff_id=$1 and id_hash<>$2',[p.id,keepHash]);await audit(c,p.id,'password.change','staff',p.id,null,ip)});}
const profileInput=z.object({
 name:z.string().trim().min(2,'Enter your full name.').max(100),
 email:z.string().trim().email('Enter a valid email address.').max(200),
 mobile:z.union([z.literal(''),phone]).transform(value=>value||null),
 avatarUrl:z.union([z.literal(''),z.string().url().max(2048)]).transform(value=>value||null)
  .refine(value=>!value||(()=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password}catch{return false}})(),'Use a secure HTTPS image URL.')
});
export async function updateProfile(pool:Pool,p:Principal,body:unknown,ip?:string){
 const profile=profileInput.parse(body);
 try{return await tx(pool,async c=>{
  const {rows:[updated]}=await c.query(`update mis.staff set name=$2,email=$3,mobile=$4,avatar_url=$5,updated_at=now()
   where id=$1 returning id,name,email,mobile,avatar_url`,[p.id,profile.name,profile.email,profile.mobile,profile.avatarUrl]);
  if(!updated) throw notFound();
  await audit(c,p.id,'profile.update','staff',p.id,null,ip);
  return updated;
 })}
 catch(error){if(isUnique(error)) throw new AppError(409,'EMAIL_IN_USE','That email address is already in use.');throw error}
}
export async function me(pool:Pool,p:Principal){
 const {rows:[r]}=await pool.query('select s.name,s.email,s.mobile,s.avatar_url,r.name role from mis.staff s left join mis.roles r on r.id=s.role_id where s.id=$1',[p.id]);
 return {id:p.id,name:r.name,email:r.email,mobile:r.mobile,avatar_url:r.avatar_url,is_super:p.isSuper,must_change_password:p.mustChange,role:r?.role??(p.isSuper?'Super administrator':null),perms:[...p.perms].map(([key,scope])=>({key,scope}))};}
export async function logout(pool:Pool,h:string,p:Principal,ip?:string){
 await tx(pool,async c=>{await c.query('delete from mis.sessions where id_hash=$1',[h]);await audit(c,p.id,'logout','staff',p.id,null,ip)});}
/* ---------- roles ---------- */
const activityQuery=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),
 q:z.string().trim().max(120).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),
 timeZone:z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}},'Choose a valid time zone.').optional()})
 .refine(f=>!f.from||!f.to||f.from<=f.to,{path:['to'],message:'End date must be on or after start date.'});
export async function listActivity(pool:Pool,p:Principal,query:unknown){
 const f=activityQuery.parse(query),args:unknown[]=[],where:string[]=[];
 const add=(sql:string,value:unknown)=>{args.push(value);where.push(sql.replace('?',`$${args.length}`))};
 if(!p.isSuper) add('a.actor_staff_id = ?',p.id);
 const timeZone=f.timeZone??'UTC';
 if(f.from){args.push(f.from,timeZone);where.push(`a.at >= (($${args.length-1}::date)::timestamp at time zone $${args.length})`)}
 if(f.to){args.push(f.to,timeZone);where.push(`a.at < ((($${args.length-1}::date + 1)::timestamp) at time zone $${args.length})`)}
 if(f.q){
  const search=`%${f.q.replace(/[\\%_]/g,'\\$&')}%`;
  args.push(search);const n=`$${args.length}`;
  where.push(`(coalesce(a.actor_name,actor.name,'') ilike ${n}
   or coalesce(a.target_name,a.detail->>'name',tenant.name,target_staff.name,target_role.name::text,'') ilike ${n}
   or coalesce(a.entity,'') ilike ${n} or a.action ilike ${n}
   or case a.action
    when 'login.success' then 'logged in sign in login'
    when 'login.failure' then 'unsuccessful sign in login incorrect password'
    when 'logout' then 'signed out logout'
    when 'password.change' then 'changed password'
    when 'profile.update' then 'updated profile'
    when 'role.create' then 'added a new role created role'
    when 'role.permissions' then 'updated permissions access role'
    when 'role.delete' then 'deleted role'
    when 'staff.create' then 'added a new staff member'
    when 'staff.status' then 'updated staff status suspended activated deactivated'
    when 'client.create' then 'added a new client created client'
    when 'client.reassign' then 'reassigned client owner'
    else '' end ilike ${n})`);
 }
 const clause=where.length?`where ${where.join(' and ')}`:'';
 const joins=`from mis.audit_log a left join mis.staff actor on actor.id=a.actor_staff_id
  left join core.tenants tenant on a.entity='tenant' and tenant.id::text=a.entity_id
  left join mis.staff target_staff on a.entity='staff' and target_staff.id::text=a.entity_id
  left join mis.roles target_role on a.entity='role' and target_role.id::text=a.entity_id`;
 const count=await pool.query(`select count(*)::int total ${joins} ${clause}`,args);
 const pageArgs=[...args,f.limit,(f.page-1)*f.limit];
 const {rows}=await pool.query(`select a.id,a.actor_staff_id,coalesce(a.actor_name,actor.name) actor_name,
  a.action,a.entity,coalesce(a.target_name,a.detail->>'name',tenant.name,target_staff.name,target_role.name::text) target_name,
  a.at,a.detail->>'status' status ${joins} ${clause}
  order by a.at desc,a.id desc limit $${args.length+1} offset $${args.length+2}`,pageArgs);
 return {items:rows.map(r=>({id:r.id,actorName:r.actor_name,action:r.action,entity:r.entity,targetName:r.target_name,
  at:r.at,summary:auditSummary(r.action,r.actor_name,r.target_name,p.isSuper?false:r.actor_staff_id===p.id,r.status)})),
  page:f.page,limit:f.limit,total:count.rows[0].total};
}
export async function permissionCatalog(pool:Pool){
 const {rows}=await pool.query('select p.key,p.label,p.scope_capable,p.module_key from mis.permissions p');
 return MODULES.map(m=>({key:m.key,name:m.name,perms:rows.filter(r=>r.module_key===m.key)}));}
export async function listRoles(pool:Pool){
 return (await pool.query(`select r.id,r.name,r.description,r.is_system,r.status,(select count(*)::int from mis.staff s where s.role_id=r.id) staff_count,
  coalesce((select json_agg(json_build_object('key',permission_key,'scope',data_scope)) from mis.role_permissions where role_id=r.id),'[]') grants from mis.roles r order by r.name`)).rows;}
export async function createRole(pool:Pool,p:Principal,body:unknown,ip?:string){
 const b=z.object({name:z.string().trim().min(2,'Enter a role name').max(60),description:z.string().trim().max(200).optional()}).parse(body);
 try{const {rows:[r]}=await pool.query('insert into mis.roles(name,description,created_by) values($1,$2,$3) returning id,name',[b.name,b.description??null,p.id]);
  await audit(pool,p.id,'role.create','role',r.id,b,ip);return r}
 catch(e){if(isUnique(e)) throw new AppError(409,'DUPLICATE','A role with this name already exists.');throw e}}
export async function setPermissions(pool:Pool,p:Principal,roleId:string,body:unknown,ip?:string){
 const {grants}=z.object({grants:z.array(z.object({key:z.string(),scope:z.enum(['own','all']).default('all')})).max(200)}).parse(body);
 const uniq=[...new Map(grants.map(g=>[g.key,g])).values()];
 return tx(pool,async c=>{
  const {rows:[role]}=await c.query('select id,is_system from mis.roles where id=$1 for update',[id(roleId)]);if(!role) throw notFound();
  if(role.is_system) throw new AppError(403,'SYSTEM_ROLE','This role is built in and cannot be edited.');
  const defs=new Map((await c.query('select key,scope_capable from mis.permissions')).rows.map(d=>[d.key,d.scope_capable]));
  for(const g of uniq){
   if(!defs.has(g.key)) throw new AppError(422,'UNKNOWN_PERMISSION',`Unknown permission: ${g.key}`);
   if(g.scope==='own'&&!defs.get(g.key)) throw new AppError(422,'SCOPE_NOT_ALLOWED',`${g.key} cannot be limited to own records.`);
   if(!p.isSuper){const have=p.perms.get(g.key);if(!have||(have==='own'&&g.scope==='all')) throw new AppError(403,'ESCALATION',"You can't grant access you don't have yourself.")}}
  await c.query('delete from mis.role_permissions where role_id=$1',[roleId]);
  for(const g of uniq) await c.query('insert into mis.role_permissions(role_id,permission_key,data_scope) values($1,$2,$3)',[roleId,g.key,g.scope]);
  await c.query('update mis.staff set perm_version=perm_version+1 where role_id=$1',[roleId]);
  await audit(c,p.id,'role.permissions','role',roleId,{grants:uniq},ip);});}
export async function deleteRole(pool:Pool,p:Principal,roleId:string,ip?:string){
 const {rows:[r]}=await pool.query('select name,is_system,(select count(*)::int from mis.staff where role_id=$1) n from mis.roles where id=$1',[id(roleId)]);
 if(!r) throw notFound();if(r.is_system) throw new AppError(403,'SYSTEM_ROLE','This role is built in and cannot be deleted.');
 if(r.n>0) throw new AppError(409,'ROLE_IN_USE',`${r.n} staff member(s) still have this role. Move them to another role first.`);
 await pool.query('delete from mis.roles where id=$1',[roleId]);await audit(pool,p.id,'role.delete','role',roleId,{name:r.name},ip);}
/* ---------- staff ---------- */
export async function listStaff(pool:Pool){
 return (await pool.query(`select s.id,s.employee_code,s.name,s.email,s.mobile,s.status,s.is_super,s.last_login_at,r.name role from mis.staff s left join mis.roles r on r.id=s.role_id order by s.name`)).rows;}
export async function assignable(pool:Pool){
 return (await pool.query(`select s.id,s.name,s.employee_code from mis.staff s where s.status in('active','invited') and (s.is_super or exists(select 1 from mis.role_permissions rp where rp.role_id=s.role_id and rp.permission_key='clients.client.view')) order by s.name`)).rows;}
export async function createStaff(pool:Pool,p:Principal,body:unknown,ip?:string){
 const b=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(200).transform(s=>s.toLowerCase()),employeeCode:z.string().trim().regex(/^[A-Za-z0-9-]{1,30}$/,'Letters, numbers and dashes only'),mobile:phone.optional(),roleId:z.string().uuid('Choose a role')}).parse(body);
 const {rows:[role]}=await pool.query(`select id from mis.roles where id=$1 and status='active'`,[b.roleId]);if(!role) throw new AppError(422,'VALIDATION','The selected role is not available.');
 if(!p.isSuper){const g=(await pool.query('select permission_key k,data_scope s from mis.role_permissions where role_id=$1',[b.roleId])).rows;
  if(g.some(x=>!p.perms.has(x.k)||(p.perms.get(x.k)==='own'&&x.s==='all'))) throw new AppError(403,'ESCALATION',"You can only assign roles that don't exceed your own access.");}
 const temp=tempPassword();
 try{const {rows:[s]}=await pool.query(`insert into mis.staff(employee_code,name,email,mobile,password_hash,role_id,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id,name,email,employee_code`,[b.employeeCode,b.name,b.email,b.mobile??null,await hashPw(temp),b.roleId,p.id]);
  await audit(pool,p.id,'staff.create','staff',s.id,{email:b.email,roleId:b.roleId},ip);return {staff:s,temporaryPassword:temp}}
 catch(e){if(isUnique(e)) throw new AppError(409,'DUPLICATE','A staff member with this email or employee code already exists.');throw e}}
export async function setStaffStatus(pool:Pool,p:Principal,staffId:string,body:unknown,ip?:string){
 const {status}=z.object({status:z.enum(['active','suspended','deactivated'])}).parse(body);
 if(id(staffId)===p.id) throw new AppError(409,'SELF','You cannot change your own status.');
 return tx(pool,async c=>{
  const {rows:[t]}=await c.query('select id,status,is_super from mis.staff where id=$1 for update',[staffId]);if(!t) throw notFound();
  if(t.is_super&&!p.isSuper) throw new AppError(403,'FORBIDDEN','Only a super administrator can change this account.');
  if(t.status==='deactivated') throw new AppError(409,'INVALID_STATE','Deactivated accounts cannot be changed.');
  if(t.is_super&&status!=='active'){const {rows:[n]}=await c.query(`select count(*)::int n from mis.staff where is_super and status in('active','invited') and id<>$1`,[staffId]);
   if(n.n<1) throw new AppError(409,'LAST_SUPER','At least one active super administrator must remain.');}
  if(status==='deactivated'){const {rows:[n]}=await c.query(`select count(*)::int n from core.tenants where owner_staff_id=$1 and status<>'closed'`,[staffId]);
   if(n.n>0) throw new AppError(409,'OWNS_CLIENTS',`This person still owns ${n.n} client(s). Reassign them first.`);}
  await c.query('update mis.staff set status=$2,updated_at=now() where id=$1',[staffId,status]);
  if(status!=='active') await c.query('delete from mis.sessions where staff_id=$1',[staffId]);
  await audit(c,p.id,'staff.status','staff',staffId,{status},ip);});}
/* ---------- clients ---------- */
const clientIn=z.object({name:z.string().trim().min(2,'Enter the company name').max(150),legalName:z.string().trim().max(150).optional(),
 taxId:z.string().trim().transform(s=>s.toUpperCase().replace(/\s+/g,'')).pipe(z.string().regex(/^[A-Z0-9-]{5,30}$/,'Tax ID must be 5–30 letters, numbers or dashes')).optional(),
 industry:z.string().trim().max(80).optional(),contactName:z.string().trim().min(2,'Enter a contact person').max(100),contactEmail:z.string().trim().email().max(200).optional(),
 contactPhone:phone.optional(),address:z.string().trim().max(500).optional(),country:z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/,'Use a 2-letter country code'),
 baseCurrency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/,'Use a 3-letter currency code')});
const COLS=`t.id,t.name,t.legal_name,t.tax_id,t.industry,t.contact_name,t.contact_email,t.contact_phone,t.address,t.country,t.base_currency,t.status,t.created_at,t.owner_staff_id,o.name owner_name`;
export async function createClient(pool:Pool,p:Principal,body:unknown,ip?:string){
 const b=clientIn.parse(body);
 try{return await tx(pool,async c=>{
  const {rows:[t]}=await c.query(`insert into core.tenants(name,legal_name,tax_id,industry,contact_name,contact_email,contact_phone,address,country,base_currency,created_by_staff_id,owner_staff_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning id,name,status`,
   [b.name,b.legalName??null,b.taxId??null,b.industry??null,b.contactName,b.contactEmail??null,b.contactPhone??null,b.address??null,b.country,b.baseCurrency,p.id]);
  await c.query(`insert into mis.client_assignments(tenant_id,staff_id,assigned_by,reason) values($1,$2,$2,'Created')`,[t.id,p.id]);
  await audit(c,p.id,'client.create','tenant',t.id,{name:b.name},ip);return t;})}
 catch(e){if(isUnique(e)) throw new AppError(409,'CLIENT_EXISTS','A client with this tax ID is already registered. Please contact your manager.');throw e}}
export async function listClients(pool:Pool,p:Principal,q:unknown){
 const f=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),q:z.string().trim().max(100).optional(),
  status:z.enum(['onboarding','active','on_hold','closed']).optional(),owner:z.string().uuid().optional()}).parse(q);
 const args:unknown[]=[],where:string[]=[];const add=(s:string,v:unknown)=>{args.push(v);where.push(s.replaceAll('?','$'+args.length))};
 if(scopeOf(p,'clients.client.view')==='own') add('t.owner_staff_id = ?',p.id);else if(f.owner) add('t.owner_staff_id = ?',f.owner);
 if(f.status) add('t.status = ?',f.status);
 if(f.q) add('(t.name ilike ? or t.tax_id ilike ? or t.contact_name ilike ?)',`%${f.q.replace(/[%_\\]/g,'\\$&')}%`);
 args.push(f.limit,(f.page-1)*f.limit);
 const {rows}=await pool.query(`select ${COLS},count(*) over()::int total from core.tenants t left join mis.staff o on o.id=t.owner_staff_id ${where.length?'where '+where.join(' and '):''} order by t.created_at desc,t.id limit $${args.length-1} offset $${args.length}`,args);
 return {items:rows.map(({total,...r})=>r),total:rows[0]?.total??0,page:f.page,limit:f.limit};}
export async function clientSummary(pool:Pool,p:Principal){
 const own=scopeOf(p,'clients.client.view')==='own';
 const {rows:[summary]}=await pool.query(`select count(*)::int total,
  count(*) filter(where status='active')::int active,
  count(*) filter(where status='onboarding')::int onboarding,
  count(*) filter(where status='on_hold')::int on_hold,
  count(*) filter(where created_at>=now()-interval '30 days')::int new_last_30_days,
  count(*) filter(where created_at>=now()-interval '60 days' and created_at<now()-interval '30 days')::int previous_30_days
  from core.tenants where not $1::boolean or owner_staff_id=$2`,[own,p.id]);
 return summary;}
export async function getClient(pool:Pool,p:Principal,cid:string){
 const {rows:[t]}=await pool.query(`select ${COLS} from core.tenants t left join mis.staff o on o.id=t.owner_staff_id where t.id=$1`,[id(cid)]);
 if(!t||(scopeOf(p,'clients.client.view')==='own'&&t.owner_staff_id!==p.id)) throw notFound();return t;}
export async function reassignClient(pool:Pool,p:Principal,cid:string,body:unknown,ip?:string){
 const b=z.object({staffId:z.string().uuid('Choose a staff member'),reason:z.string().trim().min(3,'Give a short reason').max(200)}).parse(body);
 return tx(pool,async c=>{
  const {rows:[t]}=await c.query('select id,owner_staff_id from core.tenants where id=$1 for update',[id(cid)]);if(!t) throw notFound();
  if(t.owner_staff_id===b.staffId) throw new AppError(422,'VALIDATION','This client already belongs to that person.');
  const {rows:[s]}=await c.query(`select 1 from mis.staff s where s.id=$1 and s.status in('active','invited') and (s.is_super or exists(select 1 from mis.role_permissions rp where rp.role_id=s.role_id and rp.permission_key='clients.client.view'))`,[b.staffId]);
  if(!s) throw new AppError(422,'VALIDATION','That person cannot be given clients.');
  await c.query('update mis.client_assignments set ended_at=now() where tenant_id=$1 and ended_at is null',[cid]);
  await c.query('insert into mis.client_assignments(tenant_id,staff_id,assigned_by,reason) values($1,$2,$3,$4)',[cid,b.staffId,p.id,b.reason]);
  await c.query('update core.tenants set owner_staff_id=$2,version=version+1,updated_at=now() where id=$1',[cid,b.staffId]);
  await audit(c,p.id,'client.reassign','tenant',cid,{from:t.owner_staff_id,to:b.staffId,reason:b.reason},ip);});}
