import type {Pool} from 'pg';
type P=[string,string,boolean?];
export const MODULES:{key:string;name:string;perms:P[]}[]=[
 {key:'access',name:'Access control',perms:[['role.view','View roles'],['role.manage','Create roles and set permissions'],['staff.view','View staff'],['staff.create','Create staff'],['staff.manage','Suspend, reactivate or deactivate staff'],['audit.view','View audit log']]},
 {key:'clients',name:'Clients',perms:[['client.view','View clients',true],['client.create','Register new clients'],['client.reassign','Reassign clients to another staff member']]}];
export async function syncManifests(pool:Pool){
 for(const [i,m] of MODULES.entries()){
  await pool.query('insert into mis.modules(key,name,sort) values($1,$2,$3) on conflict(key) do update set name=$2,sort=$3',[m.key,m.name,i]);
  for(const [k,l,s] of m.perms) await pool.query('insert into mis.permissions(key,module_key,label,scope_capable) values($1,$2,$3,$4) on conflict(key) do update set label=$3,scope_capable=$4',[`${m.key}.${k}`,m.key,l,!!s]);
 }}
