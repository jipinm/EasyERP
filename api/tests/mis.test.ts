import {describe,it,expect,beforeAll,afterAll} from 'vitest';import request from 'supertest';import pg from 'pg';
import {createApp} from '../src/app';import {migrate,seedRoles,ensureSuper} from '../src/bootstrap';
const url='postgres://postgres:postgres@localhost:5432/mis_test';const pool=new pg.Pool({connectionString:url});const app=createApp(pool);
const PW='Sup3r-Secret-Pass';const NEW='N3w-Strong-Passw0rd';
const agent=()=>request.agent(app).set('X-Requested-With','mis');
async function signIn(email:string,pw:string){const a=agent();const r=await a.post('/api/auth/login').send({email,password:pw});expect(r.status).toBe(200);return {a,must:r.body.data.mustChangePassword}}
async function active(email:string,temp:string){const {a}=await signIn(email,temp);const r=await a.post('/api/auth/password').send({current:temp,next:NEW,confirm:NEW});expect(r.status).toBe(200);return a}
let sup:ReturnType<typeof agent>;let roles:Record<string,string>={};let n=0;
async function mk(roleId:string,creator=sup){const email=`u${++n}@t.test`;const r=await creator.post('/api/staff').send({name:'User '+n,email,employeeCode:'E'+n,roleId});expect(r.status).toBe(201);return {email,agent:await active(email,r.body.data.temporaryPassword),id:r.body.data.staff.id as string}}
beforeAll(async()=>{await pool.query('drop schema if exists mis cascade;drop schema if exists core cascade;drop table if exists public.schema_migrations');
 await migrate(pool);await seedRoles(pool);await ensureSuper(pool,'root@t.test',PW);
 sup=await active('root@t.test',PW).catch(async()=>{const {a}=await signIn('root@t.test',PW);await a.post('/api/auth/password').send({current:PW,next:NEW,confirm:NEW});return a});
 (await sup.get('/api/roles')).body.data.forEach((r:any)=>roles[r.name]=r.id);});
afterAll(()=>pool.end());
const client=(o:object={})=>({name:'Acme Traders',contactName:'Ravi',country:'AE',baseCurrency:'AED',...o});
describe('security',()=>{
 it('rejects mutations without the CSRF header',async()=>{expect((await request(app).post('/api/auth/login').send({})).status).toBe(403)});
 it('uses one generic message for bad logins and locks after 5 failures',async()=>{
  const {email}=await mk(roles['Sales Executive']);const a=agent();
  const bad=await a.post('/api/auth/login').send({email:'nobody@t.test',password:'whatever-123456'});const bad2=await a.post('/api/auth/login').send({email,password:'wrong-password-1'});
  expect(bad.body.message).toBe(bad2.body.message);
  for(let i=0;i<5;i++) await a.post('/api/auth/login').send({email,password:'wrong-password-1'});
  expect((await a.post('/api/auth/login').send({email,password:NEW})).status).toBe(401)});
 it('forces a password change before anything else',async()=>{
  const r=await sup.post('/api/staff').send({name:'Temp User',email:'tmp@t.test',employeeCode:'TMP',roleId:roles['Sales Executive']});
  const {a,must}=await signIn('tmp@t.test',r.body.data.temporaryPassword);expect(must).toBe(true);
  const g=await a.get('/api/clients');expect(g.status).toBe(403);expect(g.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  expect((await a.post('/api/auth/password').send({next:NEW,confirm:NEW})).status).toBe(200);
  expect((await a.get('/api/me')).body.data.must_change_password).toBe(false)});
 it('updates only the signed-in profile and records a readable audit event',async()=>{
  const A=await mk(roles['Sales Executive']),B=await mk(roles['Sales Executive']);
  const updated=await A.agent.patch('/api/me/profile').send({name:'Updated User',email:'updated@t.test',mobile:'+971501234567',avatarUrl:'https://images.example.test/avatar.png'});
  expect(updated.status).toBe(200);
  expect((await A.agent.get('/api/me')).body.data).toMatchObject({name:'Updated User',email:'updated@t.test',mobile:'+971501234567',avatar_url:'https://images.example.test/avatar.png'});
  expect((await B.agent.get('/api/me')).body.data.name).not.toBe('Updated User');
  const event=await A.agent.get('/api/activity').query({q:'updated profile'});
  expect(event.body.data.items[0].summary).toBe('You updated your profile information');
  expect((await A.agent.patch('/api/me/profile').send({name:'Updated User',email:B.email,mobile:'',avatarUrl:''})).status).toBe(409);
  expect((await A.agent.patch('/api/me/profile').send({name:'Updated User',email:'updated@t.test',mobile:'123',avatarUrl:'http://insecure.example.test/a.png'})).status).toBe(422);
 });
 it('requires the current password and a matching strong-password confirmation',async()=>{
  const A=await mk(roles['Sales Executive']);
  expect((await A.agent.post('/api/auth/password').send({next:'N3w-Strong-Passw0rd',confirm:'N3w-Strong-Passw0rd'})).status).toBe(422);
  expect((await A.agent.post('/api/auth/password').send({current:NEW,next:'N3w-Strong-Passw0rd',confirm:'Different-Strong-123!'})).status).toBe(422);
  expect((await A.agent.post('/api/auth/password').send({current:NEW,next:'lowercase-password-123!',confirm:'lowercase-password-123!'})).status).toBe(422);
 });
 it('audit log is append-only',async()=>{await expect(pool.query("update mis.audit_log set action='x'")).rejects.toThrow(/append-only/);await expect(pool.query('delete from mis.audit_log')).rejects.toThrow(/append-only/)});});
describe('client scoping',()=>{
 it('sales see only their clients; managers see all; reassignment moves access',async()=>{
  const A=await mk(roles['Sales Executive']),B=await mk(roles['Sales Executive']),M=await mk(roles['Manager']);
  const c=await A.agent.post('/api/clients').send(client({taxId:'tax-100200'}));expect(c.status).toBe(201);const cid=c.body.data.id;
  expect((await A.agent.get('/api/clients')).body.data.items.map((x:any)=>x.id)).toContain(cid);
  expect((await B.agent.get('/api/clients')).body.data.items.map((x:any)=>x.id)).not.toContain(cid);
  expect((await A.agent.get('/api/clients/summary')).body.data).toMatchObject({total:1,onboarding:1,new_last_30_days:1,previous_30_days:0});
  expect((await B.agent.get('/api/clients/summary')).body.data.total).toBe(0);
  expect((await B.agent.get('/api/clients/'+cid)).status).toBe(404);
  expect((await M.agent.get('/api/clients')).body.data.items.map((x:any)=>x.id)).toContain(cid);
  expect((await M.agent.get('/api/clients/summary')).body.data.total).toBe(1);
  expect((await A.agent.post(`/api/clients/${cid}/reassign`).send({staffId:B.id,reason:'Territory'})).status).toBe(403);
  expect((await M.agent.post(`/api/clients/${cid}/reassign`).send({staffId:B.id,reason:'Territory change'})).status).toBe(200);
  expect((await A.agent.get('/api/clients/'+cid)).status).toBe(404);expect((await B.agent.get('/api/clients/'+cid)).status).toBe(200)});
 it('duplicate tax id returns 409 without leaking the other record',async()=>{
  const B=await mk(roles['Sales Executive']);const r=await B.agent.post('/api/clients').send(client({name:'Other',taxId:'TAX-100200'}));
  expect(r.status).toBe(409);expect(JSON.stringify(r.body)).not.toMatch(/Acme/)});
 it('returns field-level validation errors',async()=>{
  const B=await mk(roles['Sales Executive']);const r=await B.agent.post('/api/clients').send({contactName:'x',country:'UAE',baseCurrency:'AED'});
  expect(r.status).toBe(422);expect(r.body.errors.map((e:any)=>e.field)).toEqual(expect.arrayContaining(['name','country']))});});
describe('access control',()=>{
 it('blocks privilege escalation when assigning roles and editing grants',async()=>{
  const rr=await sup.post('/api/roles').send({name:'Staff Admin'});const rid=rr.body.data.id;
  expect((await sup.put(`/api/roles/${rid}/permissions`).send({grants:[{key:'access.staff.create'},{key:'access.staff.view'}]})).status).toBe(200);
  const event=await sup.get('/api/activity').query({q:'updated permissions'});
  expect(event.body.data.items[0].summary).toBe('Super Administrator updated permissions for role Staff Admin');
  const S=await mk(rid);expect((await S.agent.post('/api/staff').send({name:'Sneaky',email:'s@t.test',employeeCode:'SN',roleId:roles['Manager']})).body.code).toBe('ESCALATION');
  expect((await S.agent.get('/api/clients/summary')).status).toBe(403)});
 it('validates grants (unknown key, scope on non-scoped action)',async()=>{
  const rid=(await sup.post('/api/roles').send({name:'Tmp Role'})).body.data.id;
  expect((await sup.put(`/api/roles/${rid}/permissions`).send({grants:[{key:'nope.x'}]})).status).toBe(422);
  expect((await sup.put(`/api/roles/${rid}/permissions`).send({grants:[{key:'clients.client.create',scope:'own'}]})).status).toBe(422)});
 it('protects super admin, self and roles in use',async()=>{
  const me=(await sup.get('/api/me')).body.data;expect((await sup.patch(`/api/staff/${me.id}/status`).send({status:'suspended'})).body.code).toBe('SELF');
  expect((await sup.delete('/api/roles/'+roles['Manager'])).body.code).toMatch(/ROLE_IN_USE|SYSTEM_ROLE/)});
 it('suspending staff ends their session at once',async()=>{
  const U=await mk(roles['Sales Executive']);expect((await U.agent.get('/api/clients')).status).toBe(200);
  expect((await sup.patch(`/api/staff/${U.id}/status`).send({status:'suspended'})).status).toBe(200);expect((await U.agent.get('/api/clients')).status).toBe(401)});});
describe('activity log',()=>{
 it('limits standard users to their own events and gives authorized admins a searchable global view',async()=>{
  const role=(await sup.post('/api/roles').send({name:'Activity Reader'})).body.data.id;
  expect((await sup.put(`/api/roles/${role}/permissions`).send({grants:[{key:'access.audit.view'},{key:'clients.client.create'}]})).status).toBe(200);
  const noActivity=(await sup.post('/api/roles').send({name:'No Activity Access'})).body.data.id;
  const A=await mk(role),B=await mk(role),unprivileged=await mk(noActivity);
  expect((await unprivileged.agent.get('/api/activity')).status).toBe(403);
  expect((await A.agent.post('/api/clients').send(client({name:'Activity Client Alpha',taxId:'ACTIVITY-1001'}))).status).toBe(201);
  expect((await B.agent.post('/api/clients').send(client({name:'Activity Client Beta',taxId:'ACTIVITY-1002'}))).status).toBe(201);
  const own=await A.agent.get('/api/activity').query({q:'Activity Client Alpha'});
  expect(own.status).toBe(200);expect(own.body.data.total).toBe(1);
  expect(own.body.data.items[0].summary).toBe('You added a new client Activity Client Alpha');
  expect((await A.agent.get('/api/activity').query({q:'added a new client'})).body.data.total).toBe(1);
  expect(own.body.data.items[0]).not.toHaveProperty('ip');
  expect(own.body.data.items[0]).not.toHaveProperty('detail');
  expect((await A.agent.get('/api/activity').query({q:'Activity Client Beta'})).body.data.total).toBe(0);
  const global=await sup.get('/api/activity').query({q:'Activity Client Alpha',limit:1});
  expect(global.status).toBe(200);expect(global.body.data.total).toBe(1);
  expect(global.body.data.items[0].summary).toMatch(/^User \d+ added a new client Activity Client Alpha$/);
  expect(global.body.data.items[0].actorName).toMatch(/^User \d+$/);
  expect((await sup.get('/api/activity').query({from:'2026-10-30',to:'2026-10-29'})).status).toBe(422);
  const dateFilter=await sup.get('/api/activity').query({from:'2099-01-01',to:'2099-01-02'});
  expect(dateFilter.status).toBe(200);expect(dateFilter.body.data.total).toBe(0);
  expect((await sup.get('/api/activity').query({timeZone:'Not/A-Timezone'})).status).toBe(422);
 });
});
