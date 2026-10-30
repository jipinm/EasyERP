import express,{Router,type Request,type Response} from 'express';import {ZodError} from 'zod';import type {Pool} from 'pg';
import {AppError} from './errors';import {auth,need,ip} from './authz';import * as S from './services';
const ok=(res:Response,data:unknown=null,status=200)=>res.status(status).json({success:true,message:'OK',data});
export function createApp(pool:Pool){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'100kb'}));
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('x-requested-with')!=='mis') return next(new AppError(403,'CSRF','Missing required header.'));next()});
 const r=Router(),A=auth(pool),AC=auth(pool,true),ua=(q:Request)=>q.get('user-agent')??undefined;
 r.get('/health',async(_q,s)=>{await pool.query('select 1');ok(s,{status:'up'})});
 r.post('/auth/login',async(q,s)=>{const {token,mustChange}=await S.login(pool,q.body,ip(q),ua(q));
  s.cookie('mis_sid',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:12*3600e3,path:'/'});ok(s,{mustChangePassword:mustChange})});
 r.post('/auth/logout',AC,async(q,s)=>{await S.logout(pool,q.sessionHash!,q.principal!,ip(q));s.clearCookie('mis_sid',{path:'/'});ok(s)});
 r.post('/auth/password',AC,async(q,s)=>{await S.changePassword(pool,q.principal!,q.sessionHash!,q.body,ip(q));ok(s)});
 r.get('/me',AC,async(q,s)=>ok(s,await S.me(pool,q.principal!)));
 r.patch('/me/profile',A,async(q,s)=>ok(s,await S.updateProfile(pool,q.principal!,q.body,ip(q))));
 r.get('/meta/permissions',A,need('access.role.view','access.role.manage'),async(_q,s)=>ok(s,await S.permissionCatalog(pool)));
 r.get('/roles',A,need('access.role.view','access.role.manage','access.staff.create'),async(_q,s)=>ok(s,await S.listRoles(pool)));
 r.get('/activity',A,need('access.audit.view'),async(q,s)=>ok(s,await S.listActivity(pool,q.principal!,q.query)));
 r.post('/roles',A,need('access.role.manage'),async(q,s)=>ok(s,await S.createRole(pool,q.principal!,q.body,ip(q)),201));
 r.put('/roles/:id/permissions',A,need('access.role.manage'),async(q,s)=>{await S.setPermissions(pool,q.principal!,String(q.params.id),q.body,ip(q));ok(s)});
 r.delete('/roles/:id',A,need('access.role.manage'),async(q,s)=>{await S.deleteRole(pool,q.principal!,String(q.params.id),ip(q));ok(s)});
 r.get('/staff/assignable',A,need('clients.client.reassign'),async(_q,s)=>ok(s,await S.assignable(pool)));
 r.get('/staff',A,need('access.staff.view','access.staff.manage','access.staff.create'),async(_q,s)=>ok(s,await S.listStaff(pool)));
 r.post('/staff',A,need('access.staff.create'),async(q,s)=>ok(s,await S.createStaff(pool,q.principal!,q.body,ip(q)),201));
 r.patch('/staff/:id/status',A,need('access.staff.manage'),async(q,s)=>{await S.setStaffStatus(pool,q.principal!,String(q.params.id),q.body,ip(q));ok(s)});
 r.get('/clients/summary',A,need('clients.client.view'),async(q,s)=>ok(s,await S.clientSummary(pool,q.principal!)));
 r.get('/clients',A,need('clients.client.view'),async(q,s)=>ok(s,await S.listClients(pool,q.principal!,q.query)));
 r.post('/clients',A,need('clients.client.create'),async(q,s)=>ok(s,await S.createClient(pool,q.principal!,q.body,ip(q)),201));
 r.get('/clients/:id',A,need('clients.client.view'),async(q,s)=>ok(s,await S.getClient(pool,q.principal!,String(q.params.id))));
 r.post('/clients/:id/reassign',A,need('clients.client.reassign'),async(q,s)=>{await S.reassignClient(pool,q.principal!,String(q.params.id),q.body,ip(q));ok(s)});
 app.use('/api',r);
 app.use((_q,_s,next)=>next(new AppError(404,'NOT_FOUND','Not found.')));
 app.use((e:any,_q:Request,s:Response,_n:express.NextFunction)=>{
  if(e instanceof ZodError) return s.status(422).json({success:false,code:'VALIDATION',message:'Please correct the highlighted fields.',errors:e.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  if(e instanceof AppError) return s.status(e.status).json({success:false,code:e.code,message:e.message});
  if(e?.type==='entity.parse.failed') return s.status(400).json({success:false,code:'BAD_JSON',message:'Malformed request body.'});
  console.error(e);s.status(500).json({success:false,code:'INTERNAL',message:'Something went wrong. Please try again.'})});
 return app;}
