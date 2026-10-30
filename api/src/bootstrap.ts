import {readdirSync,readFileSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import type {Pool} from 'pg';
import {syncManifests} from './modules';import {hashPw} from './security';
const dir=join(dirname(fileURLToPath(import.meta.url)),'../../db/migrations');
export async function migrate(pool:Pool){
 await pool.query('create table if not exists public.schema_migrations(name text primary key, at timestamptz default now())');
 for(const f of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()){
  if((await pool.query('select 1 from public.schema_migrations where name=$1',[f])).rowCount) continue;
  const c=await pool.connect();try{await c.query('begin');await c.query(readFileSync(join(dir,f),'utf8'));await c.query('insert into public.schema_migrations(name) values($1)',[f]);await c.query('commit')}catch(e){await c.query('rollback');throw e}finally{c.release()}}}
const TEMPLATES=[{name:'Manager',description:'Sees and manages all clients',grants:[['clients.client.view','all'],['clients.client.create','all'],['clients.client.reassign','all'],['access.staff.view','all'],['access.audit.view','all']]},
 {name:'Sales Executive',description:'Registers clients and sees only their own',grants:[['clients.client.view','own'],['clients.client.create','all'],['access.audit.view','all']]}];
export async function seedRoles(pool:Pool){
 await syncManifests(pool);
 for(const t of TEMPLATES){const {rows:[r]}=await pool.query('insert into mis.roles(name,description) values($1,$2) on conflict(name) do nothing returning id',[t.name,t.description]);
  const roleId=r?.id??(await pool.query('select id from mis.roles where name=$1',[t.name])).rows[0].id;
  for(const [k,s] of t.grants) await pool.query('insert into mis.role_permissions(role_id,permission_key,data_scope) values($1,$2,$3) on conflict do nothing',[roleId,k,s])}}
export async function ensureSuper(pool:Pool,email:string,password:string){
 if((await pool.query('select 1 from mis.staff where is_super')).rowCount) throw new Error('A super administrator already exists; refusing to create another.');
 if(password.length<12) throw new Error('SUPER_PASSWORD must be at least 12 characters.');
 await pool.query(`insert into mis.staff(employee_code,name,email,password_hash,is_super,status) values('SUPER','Super Administrator',$1,$2,true,'invited')`,[email.toLowerCase(),await hashPw(password)]);}
