import type {Request,RequestHandler} from 'express';import type {Pool} from 'pg';import {AppError} from './errors';import {sha} from './security';
export interface Principal{id:string;name:string;email:string;isSuper:boolean;mustChange:boolean;perms:Map<string,'own'|'all'>}
declare global{namespace Express{interface Request{principal?:Principal;sessionHash?:string}}}
export const can=(p:Principal,k:string)=>p.isSuper||p.perms.has(k);
export const scopeOf=(p:Principal,k:string):'own'|'all'|undefined=>p.isSuper?'all':p.perms.get(k);
export const auth=(pool:Pool,allowChange=false):RequestHandler=>async(req,_res,next)=>{
 const sid=/(?:^|;\s*)mis_sid=([^;]+)/.exec(req.headers.cookie??'')?.[1];
 if(!sid) throw new AppError(401,'UNAUTHENTICATED','Please sign in.');
 const h=sha(sid);
 const {rows:[s]}=await pool.query(`select f.id,f.name,f.email,f.is_super,f.must_change_password,f.role_id from mis.sessions se join mis.staff f on f.id=se.staff_id
  where se.id_hash=$1 and se.expires_at>now() and se.last_seen_at>now()-interval '30 minutes' and f.status in('invited','active')`,[h]);
 if(!s) throw new AppError(401,'UNAUTHENTICATED','Your session has ended. Please sign in again.');
 await pool.query('update mis.sessions set last_seen_at=now() where id_hash=$1',[h]);
 const perms=new Map<string,'own'|'all'>();
 if(s.is_super){(await pool.query('select key from mis.permissions')).rows.forEach(r=>perms.set(r.key,'all'))}
 else if(s.role_id)(await pool.query(`select rp.permission_key k,rp.data_scope sc from mis.role_permissions rp join mis.roles r on r.id=rp.role_id where r.id=$1 and r.status='active'`,[s.role_id])).rows.forEach(r=>perms.set(r.k,r.sc));
 if(s.must_change_password&&!allowChange) throw new AppError(403,'PASSWORD_CHANGE_REQUIRED','Please set a new password to continue.');
 req.principal={id:s.id,name:s.name,email:s.email,isSuper:s.is_super,mustChange:s.must_change_password,perms};req.sessionHash=h;next();};
export const need=(...keys:string[]):RequestHandler=>(req,_res,next)=>{const p=req.principal!;keys.some(k=>can(p,k))?next():next(new AppError(403,'FORBIDDEN','You do not have permission to do this.'))};
export const ip=(r:Request)=>r.ip??undefined;
