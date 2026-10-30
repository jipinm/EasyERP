import {useEffect,useState,useCallback,type ComponentProps,type FormEvent,type KeyboardEvent,type ReactNode} from 'react';import {api,ApiError} from './api';
type Me={id:string;name:string;email:string;mobile:string|null;avatar_url:string|null;role:string|null;must_change_password:boolean;is_super:boolean;perms:{key:string;scope:string}[]};
const B='btn btn-primary',G='btn btn-secondary',I='field-input';
const TONE:Record<string,string>={active:'status-positive',onboarding:'status-info',invited:'status-info',on_hold:'status-warning',suspended:'status-warning',closed:'status-neutral',deactivated:'status-neutral'};
const Pill=({s}:{s:string})=><span className={`status-pill ${TONE[s]??'status-neutral'}`}><span className="status-dot"/>{s.replace('_',' ')}</span>;
function useLoad<T>(fn:()=>Promise<T>,deps:unknown[]){const [d,setD]=useState<T|null>(null);const [err,setErr]=useState('');const [n,setN]=useState(0);
 useEffect(()=>{let live=true;setErr('');fn().then(x=>live&&setD(x)).catch(e=>live&&setErr(e.message));return()=>{live=false}},[...deps,n]);return {d,err,reload:()=>setN(x=>x+1)}}
const Field=({label,err,children}:{label:string;err?:string;children:ReactNode})=><label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}{err&&<span className="mt-1 block text-xs text-red-600">{err}</span>}</label>;
function PasswordInput({className,...props}:Omit<ComponentProps<'input'>,'type'>){
 const [visible,setVisible]=useState(false);
 return <div className="relative"><input {...props} className={`${className??''} pr-11`} type={visible?'text':'password'}/>
  <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>
   {visible?<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.6 2.7 9.7 2.5 12c.5 1.5 2.2 4.2 5.9 5.8a10 10 0 003.6.7c.8 0 1.6-.1 2.3-.3"/></svg>:<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>}
  </button>
 </div>}
type PasswordFieldProps=Omit<ComponentProps<'input'>,'type'|'id'>&{id:string;label:string;err?:string};
function PasswordField({id,label,err,...props}:PasswordFieldProps){
 return <div className="block text-sm"><label htmlFor={id} className="mb-1 block font-medium text-slate-700">{label}</label><PasswordInput {...props} id={id} className={I}/>{err&&<span className="mt-1 block text-xs text-red-600">{err}</span>}</div>
}
const Skeleton=({className=''}:{className?:string})=><span aria-hidden="true" className={`skeleton-block block ${className}`}/>;
function SkeletonRows({columns,rows=5}:{columns:number;rows?:number}){
 return <>{Array.from({length:rows},(_,row)=><tr key={row} className="border-t">{Array.from({length:columns},(_,column)=><td key={column} className="px-4 py-3"><Skeleton className={`${column===0?'h-4 w-32':'h-4 w-20'} ${row%2?'opacity-70':''}`}/>{column===0&&<Skeleton className="mt-2 h-3 w-24 opacity-60"/>}</td>)}</tr>)}</>;
}
function AppSkeleton(){
 return <div className="flex min-h-screen items-center justify-center p-4" role="status" aria-label="Loading sign-in">
  <span className="sr-only">Loading sign-in…</span>
  <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
   <Skeleton className="h-7 w-36"/>
   <Skeleton className="h-4 w-24"/>
   <div className="space-y-2"><Skeleton className="h-4 w-16"/><Skeleton className="h-10 w-full rounded-lg"/></div>
   <div className="space-y-2"><Skeleton className="h-4 w-20"/><Skeleton className="h-10 w-full rounded-lg"/></div>
   <Skeleton className="h-10 w-full rounded-lg"/>
  </div>
 </div>
}
const Modal=({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode})=><div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center p-4" onKeyDown={e=>e.key==='Escape'&&onClose()}><div className="modal-panel max-h-[90vh] w-full max-w-lg overflow-auto"><div className="mb-4 flex justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="text-slate-500">✕</button></div>{children}</div></div>;
const Err=({m}:{m:string})=>m?<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{m}</p>:null;
const Empty=({t}:{t:string})=><p className="empty-state">{t}</p>;
function useForm(init:Record<string,string>,submit:(v:Record<string,string>)=>Promise<void>){const [v,setV]=useState(init);const [f,setF]=useState<Record<string,string>>({});const [e,setE]=useState('');const [busy,setBusy]=useState(false);
 return {v,f,e,busy,set:(k:string)=>(x:{target:{value:string}})=>{setV({...v,[k]:x.target.value});setF(current=>({...current,[k]:''}));setE('')},
  go:async(ev:{preventDefault:()=>void})=>{ev.preventDefault();setBusy(true);setE('');setF({});try{await submit(v)}catch(x){if(x instanceof ApiError){setF(x.fields);setE(x.message)}else setE('Network problem. Please try again.')}finally{setBusy(false)}}}}
function Login({onDone}:{onDone:()=>void}){
 const l=useForm({email:'',password:''},async v=>{await api('/auth/login','POST',v);onDone()});
 return <div className="auth-page"><form onSubmit={l.go} className="auth-card"><div className="brand-lockup"><span className="brand-mark">B</span><span className="brand-name">Business <span>MIS</span></span></div><div><h1 className="auth-title">Welcome back</h1><p className="auth-subtitle">Sign in to your business workspace</p></div><Err m={l.e}/>
  <Field label="Email"><input className={I} type="email" autoFocus autoComplete="username" value={l.v.email} onChange={l.set('email')}/></Field>
  <PasswordField id="login-password" label="Password" autoComplete="current-password" value={l.v.password} onChange={l.set('password')}/><button className={B+' auth-submit'} disabled={l.busy}>{l.busy?'Signing in…':'Sign in'}<span aria-hidden="true">→</span></button><p className="auth-footnote">Secure access to your business operations</p></form></div>}
function ChangePw({onDone}:{onDone:()=>void}){
 const f=useForm({next:'',confirm:''},async v=>{if(v.next!==v.confirm)throw new ApiError(422,'VALIDATION','New password and confirmation do not match.',{confirm:'Passwords do not match.'});await api('/auth/password','POST',v);onDone()});
 return <div className="auth-page"><form onSubmit={f.go} className="auth-card"><div className="brand-lockup"><span className="brand-mark">B</span><span className="brand-name">Business <span>MIS</span></span></div><div><h1 className="auth-title">Set a new password</h1><p className="auth-subtitle">Choose a strong password to secure your account.</p></div><Err m={f.e}/>
  <PasswordField id="new-password" label="New password" err={f.f.next} autoComplete="new-password" required value={f.v.next} onChange={f.set('next')}/><p className="password-hint">At least 12 characters, with uppercase and lowercase letters, a number, and a symbol.</p><PasswordField id="confirm-new-password" label="Confirm new password" err={f.v.confirm&&f.v.next!==f.v.confirm?'Passwords do not match.':undefined} autoComplete="new-password" required aria-invalid={!!f.v.confirm&&f.v.next!==f.v.confirm} value={f.v.confirm} onChange={f.set('confirm')}/>{f.v.confirm&&f.v.next===f.v.confirm&&<p className="profile-match" role="status">Passwords match.</p>}<button className={B+' auth-submit'} disabled={f.busy}>Save and continue<span aria-hidden="true">→</span></button></form></div>}
type Cl={id:string;name:string;tax_id:string|null;contact_name:string;country:string;base_currency:string;status:string;owner_name:string|null;owner_staff_id:string;created_at:string};
function Clients({can}:{can:(k:string)=>boolean}){
 const [q,setQ]=useState('');const [status,setStatus]=useState('');const [page,setPage]=useState(1);const [dq,setDq]=useState('');const [modal,setModal]=useState<'new'|Cl|null>(null);
 useEffect(()=>{const t=setTimeout(()=>{setDq(q);setPage(1)},250);return()=>clearTimeout(t)},[q]);
 const L=useLoad(()=>api<{items:Cl[];total:number;limit:number}>(`/clients?page=${page}&q=${encodeURIComponent(dq)}${status?'&status='+status:''}`),[page,dq,status]);
 const pages=L.d?Math.max(1,Math.ceil(L.d.total/L.d.limit)):1;
 return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">RELATIONSHIP MANAGEMENT</p><h1 className="page-title">Clients</h1><p className="page-description">Manage your client relationships and account ownership.</p></div>{can('clients.client.create')&&<button className={B} onClick={()=>setModal('new')}>+ New client</button>}</div><div className="toolbar">
  <input className={I+' !w-60'} placeholder="Search name, tax ID, contact…" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search clients"/>
  <select className={I+' !w-40'} value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}} aria-label="Status"><option value="">All statuses</option>{['onboarding','active','on_hold','closed'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select>
  <span className="toolbar-hint">Search by company, tax ID or contact</span></div><Err m={L.err}/>
  <div className="data-card"><div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Company','Contact','Country','Status','Owner',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{L.d?.items.map(c=><tr key={c.id} className="border-t"><td className="px-4 py-2 font-medium">{c.name}<div className="text-xs font-normal text-slate-500">{c.tax_id}</div></td><td className="px-4 py-2">{c.contact_name}</td><td className="px-4 py-2">{c.country} · {c.base_currency}</td><td className="px-4 py-2"><Pill s={c.status}/></td><td className="px-4 py-2">{c.owner_name}</td>
   <td className="px-4 py-2 text-right">{can('clients.client.reassign')&&<button className="text-indigo-600 hover:underline" onClick={()=>setModal(c)}>Reassign</button>}</td></tr>)}{!L.d&&!L.err&&<SkeletonRows columns={6}/>}</tbody></table>
  {L.d&&!L.d.items.length&&<Empty t="No clients found. Try a different search, or register a new client."/>}</div></div>
  <div className="pagination"><span>Page <strong>{page}</strong> of {pages}</span><button className={G} disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><button className={G} disabled={page>=pages} onClick={()=>setPage(page+1)}>Next</button></div>
  {modal==='new'&&<NewClient onClose={()=>setModal(null)} onDone={()=>{setModal(null);L.reload()}}/>}{modal&&modal!=='new'&&<Reassign c={modal} onClose={()=>setModal(null)} onDone={()=>{setModal(null);L.reload()}}/>}</div>}
function NewClient({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
 const f=useForm({name:'',contactName:'',contactPhone:'',contactEmail:'',taxId:'',country:'AE',baseCurrency:'AED'},async v=>{const b:Record<string,string>={};for(const k in v) if(v[k].trim()) b[k]=v[k];await api('/clients','POST',b);onDone()});
 const T=(k:string,label:string,ph='')=><Field label={label} err={f.f[k]}><input className={I} placeholder={ph} value={f.v[k]} onChange={f.set(k)}/></Field>;
 return <Modal title="Register a new client" onClose={onClose}><form onSubmit={f.go} className="space-y-3"><Err m={f.e&&!Object.keys(f.f).length?f.e:''}>{}</Err>{T('name','Company name *')}{T('contactName','Contact person *')}
  <div className="grid grid-cols-2 gap-3">{T('contactPhone','Phone','+971 50 123 4567')}{T('contactEmail','Email')}</div>{T('taxId','Tax / registration ID')}
  <div className="grid grid-cols-2 gap-3">{T('country','Country code *','AE')}{T('baseCurrency','Currency *','AED')}</div>
  <div className="flex justify-end gap-2 pt-2"><button type="button" className={G} onClick={onClose}>Cancel</button><button className={B} disabled={f.busy}>Save client</button></div></form></Modal>}
function Reassign({c,onClose,onDone}:{c:Cl;onClose:()=>void;onDone:()=>void}){
 const S=useLoad(()=>api<{id:string;name:string;employee_code:string}[]>('/staff/assignable'),[]);
 const f=useForm({staffId:'',reason:''},async v=>{await api(`/clients/${c.id}/reassign`,'POST',v);onDone()});
 return <Modal title={`Reassign ${c.name}`} onClose={onClose}><form onSubmit={f.go} className="space-y-3"><Err m={f.e}/>
  <Field label="New owner" err={f.f.staffId}><select className={I} value={f.v.staffId} onChange={f.set('staffId')}><option value="">{S.d?'Choose…':'Loading staff…'}</option>{S.d?.filter(s=>s.id!==c.owner_staff_id).map(s=><option key={s.id} value={s.id}>{s.name} ({s.employee_code})</option>)}</select></Field>
  <Field label="Reason" err={f.f.reason}><input className={I} value={f.v.reason} onChange={f.set('reason')}/></Field>
  <div className="flex justify-end gap-2"><button type="button" className={G} onClick={onClose}>Cancel</button><button className={B} disabled={f.busy}>Reassign</button></div></form></Modal>}
type Role={id:string;name:string;description:string|null;is_system:boolean;staff_count:number;grants:{key:string;scope:string}[]};
function Staff({can}:{can:(k:string)=>boolean}){
 const L=useLoad(()=>api<any[]>('/staff'),[]);const [show,setShow]=useState(false);const [temp,setTemp]=useState<{email:string;pw:string}|null>(null);const [err,setErr]=useState('');
 const st=async(id:string,status:string)=>{setErr('');try{await api(`/staff/${id}/status`,'PATCH',{status});L.reload()}catch(e:any){setErr(e.message)}};
 return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">TEAM &amp; ACCESS</p><h1 className="page-title">Staff</h1><p className="page-description">Manage team members, roles, and account status.</p></div>{can('access.staff.create')&&<button className={B} onClick={()=>setShow(true)}>+ Add staff</button>}</div><Err m={err||L.err}/>
  <div className="data-card"><div className="overflow-x-auto"><table className="data-table"><thead><tr>{['Name','Role','Status','Last sign-in',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{L.d?.map(s=><tr key={s.id} className="border-t"><td className="px-4 py-2 font-medium">{s.name}<div className="text-xs font-normal text-slate-500">{s.email} · {s.employee_code}</div></td><td className="px-4 py-2">{s.role??'Super administrator'}</td><td className="px-4 py-2"><Pill s={s.status}/></td><td className="px-4 py-2">{s.last_login_at?new Date(s.last_login_at).toLocaleString():'Never'}</td>
   <td className="row-actions">{can('access.staff.manage')&&s.status!=='deactivated'&&(s.status==='suspended'?<button className="text-indigo-600" onClick={()=>st(s.id,'active')}>Reactivate</button>:<button className="text-amber-700" onClick={()=>st(s.id,'suspended')}>Suspend</button>)}{can('access.staff.manage')&&s.status!=='deactivated'&&<button className="text-red-600" onClick={()=>confirm('Deactivate permanently?')&&st(s.id,'deactivated')}>Deactivate</button>}</td></tr>)}{!L.d&&!L.err&&<SkeletonRows columns={5}/>}</tbody></table>{L.d&&!L.d.length&&<Empty t="No staff members found."/>}</div></div>
  {show&&<NewStaff onClose={()=>setShow(false)} onDone={(email,pw)=>{setShow(false);setTemp({email,pw});L.reload()}}/>}
  {temp&&<Modal title="Staff member created" onClose={()=>setTemp(null)}><p className="text-sm">Share this temporary password with <b>{temp.email}</b>. It is shown only once; they must change it at first sign-in.</p><p className="my-3 select-all rounded-lg bg-slate-100 p-3 font-mono">{temp.pw}</p><button className={B} onClick={()=>setTemp(null)}>Done</button></Modal>}</div>}
type ActivityEntry={id:string;actorName:string|null;action:string;entity:string|null;targetName:string|null;at:string;summary:string};
type ActivityPage={items:ActivityEntry[];page:number;limit:number;total:number};
const ACTIVITY_ENTITY_LABEL:Record<string,string>={tenant:'client',staff:'staff',role:'role'};
function ActivityRows({items,dateTime}:{items:ActivityEntry[];dateTime:Intl.DateTimeFormat}){
 return <>{items.map(event=><article className="activity-row" key={event.id}><span className={`activity-event-icon ${event.action.startsWith('client.')?'event-client':event.action.startsWith('staff.')?'event-staff':event.action.startsWith('role.')?'event-role':'event-account'}`} aria-hidden="true">{event.action.startsWith('client.')?'▤':event.action.startsWith('staff.')?'♙':event.action.startsWith('role.')?'⚙':'↗'}</span><div className="activity-row-content"><p>{event.summary}</p><div className="activity-row-meta"><span className="activity-entity">{event.entity?ACTIVITY_ENTITY_LABEL[event.entity]??event.entity:'account'}</span><time dateTime={event.at} title={new Date(event.at).toLocaleString()}>{dateTime.format(new Date(event.at))}</time></div></div></article>)}</>;
}
type ClientSummary={total:number;active:number;onboarding:number;on_hold:number;new_last_30_days:number;previous_30_days:number};
function Dashboard({name,can}:{name:string;can:(k:string)=>boolean}){
 const summary=useLoad(()=>api<ClientSummary>('/clients/summary'),[]);
 const [newClient,setNewClient]=useState(false);
 const recentTrend=summary.d?summary.d.new_last_30_days-summary.d.previous_30_days:0;
 const trendBadge=summary.d?summary.d.previous_30_days===0?(recentTrend>0?'↑ from 0':'No change vs prior 30 days'):recentTrend===0?'No change vs prior 30 days':`${recentTrend>0?'↑':'↓'} ${Math.round(Math.abs(recentTrend)/summary.d.previous_30_days*100)}% vs prior 30 days`:'Last 30 days';
 const metrics=[
  {label:'Total clients',value:summary.d?.total,icon:'▤',tone:'metric-violet',badge:'Portfolio'},
  {label:'Active',value:summary.d?.active,icon:'↗',tone:'metric-green',badge:'In good standing'},
  {label:'Onboarding',value:summary.d?.onboarding,icon:'◷',tone:'metric-blue',badge:'In progress'},
  {label:'On hold',value:summary.d?.on_hold,icon:'!',tone:'metric-amber',badge:'Needs attention'},
  {label:'New clients',value:summary.d?.new_last_30_days,icon:'＋',tone:'metric-violet',badge:trendBadge}
 ];
 const shortcuts=[
  {id:'clients',label:'Client directory',description:'Search, review and manage client records.',icon:'▤',show:can('clients.client.view')},
  {id:'staff',label:'Team',description:'View team members and account status.',icon:'♙',show:can('access.staff.view')||can('access.staff.manage')},
  {id:'roles',label:'Roles & access',description:'Review roles and permission settings.',icon:'⚙',show:can('access.role.view')||can('access.role.manage')},
  {id:'activity',label:'Activity log',description:'See recent actions across your workspace.',icon:'↗',show:can('access.audit.view')}
 ].filter(link=>link.show);
 return <div className="page-stack dashboard-page">
  <div className="page-heading"><div><p className="eyebrow">CLIENT RELATIONSHIPS</p><h1 className="page-title">Clients dashboard</h1><p className="page-description">Welcome back, {name}. Here’s your client portfolio at a glance.</p></div>{can('clients.client.create')&&<button className={B} onClick={()=>setNewClient(true)}>+ Add client</button>}</div>
  <section className="dashboard-metrics" aria-label="Client summary">
   {metrics.map(metric=><article className={`dashboard-metric ${metric.tone}`} key={metric.label}><div className="dashboard-metric-top"><span className="dashboard-metric-icon" aria-hidden="true">{metric.icon}</span><span className="dashboard-metric-badge">{metric.badge}</span></div><p>{metric.label}</p><strong>{summary.d?metric.value:summary.err?'—':<Skeleton className="h-8 w-16"/>}</strong></article>)}
  </section>
  <Err m={summary.err}/>
  <section className="dashboard-hub" aria-labelledby="dashboard-hub-title">
   <div className="dashboard-section-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h2 id="dashboard-hub-title">Quick access</h2></div><span>Go straight to a task</span></div>
   <div className="dashboard-shortcuts">
    {can('clients.client.create')&&<button className="dashboard-shortcut dashboard-shortcut-action" onClick={()=>setNewClient(true)}><span className="dashboard-shortcut-icon" aria-hidden="true">＋</span><span><b>Add a client</b><small>Register a new client and owner.</small></span><span className="dashboard-shortcut-arrow" aria-hidden="true">›</span></button>}
    {shortcuts.map(link=><a className="dashboard-shortcut" key={link.id} href={`#${link.id}`}><span className="dashboard-shortcut-icon" aria-hidden="true">{link.icon}</span><span><b>{link.label}</b><small>{link.description}</small></span><span className="dashboard-shortcut-arrow" aria-hidden="true">›</span></a>)}
   </div>
  </section>
  {can('access.audit.view')&&<DashboardActivity/>}
  {newClient&&<NewClient onClose={()=>setNewClient(false)} onDone={()=>{setNewClient(false);summary.reload()}}/>}
 </div>
}
function DashboardActivity(){
 const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const L=useLoad(()=>api<ActivityPage>(`/activity?page=1&limit=10&timeZone=${encodeURIComponent(timeZone)}`),[timeZone]);
 const dateTime=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
 return <section className="activity-card dashboard-activity-card" aria-label="Recent activity">
  <div className="activity-card-heading"><div><h2>Recent activity</h2><p>Your latest 10 activity events</p></div><a className="dashboard-view-all" href="#activity">View activity log <span aria-hidden="true">→</span></a></div>
  <Err m={L.err}/>
  {!L.d&&!L.err&&<div role="status" aria-label="Loading recent activity" className="activity-list">{Array.from({length:3},(_,i)=><div className="activity-row" key={i}><Skeleton className="h-10 w-10 rounded-xl"/><div className="activity-row-content"><Skeleton className="h-4 w-3/5"/><Skeleton className="mt-2 h-3 w-2/5"/></div></div>)}</div>}
  {L.d&&!L.d.items.length&&!L.err&&<div className="activity-empty"><span>⌕</span><h3>No activity yet</h3><p>Actions in your workspace will appear here.</p></div>}
  {!!L.d?.items.length&&<div className="activity-list"><ActivityRows items={L.d.items} dateTime={dateTime}/></div>}
 </section>
}
function Profile({me,onSaved}:{me:Me;onSaved:()=>Promise<void>}){
 const [profile,setProfile]=useState({name:me.name,email:me.email,mobile:me.mobile??'',avatarUrl:me.avatar_url??''});
 const [profileErrors,setProfileErrors]=useState<Record<string,string>>({});
 const [profileError,setProfileError]=useState(''),[profileSaved,setProfileSaved]=useState('');
 const [imageFailed,setImageFailed]=useState(false),[profileBusy,setProfileBusy]=useState(false);
 const [password,setPassword]=useState({current:'',next:'',confirm:''});
 const [passwordErrors,setPasswordErrors]=useState<Record<string,string>>({});
 const [passwordError,setPasswordError]=useState(''),[passwordSaved,setPasswordSaved]=useState('');
 const [passwordBusy,setPasswordBusy]=useState(false);
 useEffect(()=>{setProfile({name:me.name,email:me.email,mobile:me.mobile??'',avatarUrl:me.avatar_url??''})},[me.id,me.name,me.email,me.mobile,me.avatar_url]);
 const saveProfile=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setProfileBusy(true);setProfileError('');setProfileErrors({});setProfileSaved('');
  try{await api('/me/profile','PATCH',profile);await onSaved();setProfileSaved('Your profile has been updated.')}
  catch(error){if(error instanceof ApiError){setProfileErrors(error.fields);setProfileError(error.message)}else setProfileError('Network problem. Please try again.')}
  finally{setProfileBusy(false)}
 };
 const changePassword=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setPasswordError('');setPasswordErrors({});
  if(password.next!==password.confirm){setPasswordErrors({confirm:'Passwords do not match.'});return}
  setPasswordBusy(true);setPasswordSaved('');
  try{await api('/auth/password','POST',password);setPassword({current:'',next:'',confirm:''});setPasswordSaved('Your password has been updated. Other active sessions have been signed out.')}
  catch(error){if(error instanceof ApiError){setPasswordErrors(error.fields);setPasswordError(error.message)}else setPasswordError('Network problem. Please try again.')}
  finally{setPasswordBusy(false)}
 };
 const initials=profile.name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()||'U';
 return <div className="page-stack profile-page">
  <div className="page-heading"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1 className="page-title">Your profile</h1><p className="page-description">Manage your personal information and keep your account secure.</p></div></div>
  <section className="profile-card" aria-labelledby="profile-details-title">
   <div className="profile-card-heading"><div><h2 id="profile-details-title">Personal information</h2><p>These details are associated with your account.</p></div></div>
   <form onSubmit={saveProfile} className="profile-form" noValidate>
    <div className="profile-avatar-editor"><span className="profile-avatar">{profile.avatarUrl&&!imageFailed?<img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" onError={()=>setImageFailed(true)}/>:initials}</span><div><b>Profile photo</b><span>Add an image using a secure image URL.</span></div></div>
    <Err m={profileError}/>{profileSaved&&<p className="profile-success" role="status">{profileSaved}</p>}
    <div className="profile-form-grid">
     <Field label="Full name" err={profileErrors.name}><input className={I} autoComplete="name" required aria-invalid={!!profileErrors.name} value={profile.name} onChange={event=>{setProfileError('');setProfileErrors({...profileErrors,name:''});setProfile({...profile,name:event.target.value})}}/></Field>
     <Field label="Email address" err={profileErrors.email}><input className={I} type="email" autoComplete="email" required aria-invalid={!!profileErrors.email} value={profile.email} onChange={event=>{setProfileError('');setProfileErrors({...profileErrors,email:''});setProfile({...profile,email:event.target.value})}}/></Field>
     <Field label="Contact number" err={profileErrors.mobile}><input className={I} type="tel" autoComplete="tel" aria-invalid={!!profileErrors.mobile} value={profile.mobile} onChange={event=>{setProfileError('');setProfileErrors({...profileErrors,mobile:''});setProfile({...profile,mobile:event.target.value})}}/></Field>
     <Field label="Profile image URL" err={profileErrors.avatarUrl}><input className={I} type="url" inputMode="url" aria-invalid={!!profileErrors.avatarUrl} placeholder="https://example.com/photo.jpg" value={profile.avatarUrl} onChange={event=>{setProfileError('');setImageFailed(false);setProfileErrors({...profileErrors,avatarUrl:''});setProfile({...profile,avatarUrl:event.target.value})}}/></Field>
    </div>
    <div className="profile-form-actions"><button className={B} disabled={profileBusy}>{profileBusy?'Saving…':'Save changes'}</button></div>
   </form>
  </section>
  <section className="profile-card" aria-labelledby="profile-password-title">
   <div className="profile-card-heading"><div><h2 id="profile-password-title">Change password</h2><p>Use a unique password to protect your account.</p></div><span className="profile-security-mark" aria-hidden="true">⌑</span></div>
   <form onSubmit={changePassword} className="profile-password-form">
    <Err m={passwordError}/>{passwordSaved&&<p className="profile-success" role="status">{passwordSaved}</p>}
    <PasswordField id="profile-current-password" label="Current password" autoComplete="current-password" required aria-invalid={!!passwordErrors.current} value={password.current} err={passwordErrors.current} onChange={event=>{setPasswordError('');setPasswordErrors({...passwordErrors,current:''});setPassword({...password,current:event.target.value})}}/>
    <div className="profile-form-grid">
     <PasswordField id="profile-new-password" label="New password" autoComplete="new-password" required aria-invalid={!!passwordErrors.next} value={password.next} err={passwordErrors.next} onChange={event=>{setPasswordError('');setPasswordErrors({...passwordErrors,next:''});setPassword({...password,next:event.target.value})}}/>
     <PasswordField id="profile-confirm-password" label="Confirm new password" autoComplete="new-password" required aria-invalid={!!passwordErrors.confirm||(!!password.confirm&&password.next!==password.confirm)} value={password.confirm} err={password.confirm&&password.next!==password.confirm?'Passwords do not match.':passwordErrors.confirm} onChange={event=>{setPasswordError('');setPasswordErrors({...passwordErrors,confirm:''});setPassword({...password,confirm:event.target.value})}}/>
    </div>
    {password.confirm&&password.next===password.confirm&&<p className="profile-match" role="status">Passwords match.</p>}
    <p className="password-hint">At least 12 characters, with uppercase and lowercase letters, a number, and a symbol.</p>
    <div className="profile-form-actions"><button className={B} disabled={passwordBusy}>{passwordBusy?'Updating…':'Update password'}</button></div>
   </form>
  </section>
 </div>
}
function Activity({isSuper}:{isSuper:boolean}){
 const [term,setTerm]=useState(''),[q,setQ]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1);
 useEffect(()=>{const timer=setTimeout(()=>{setQ(term.trim());setPage(1)},250);return()=>clearTimeout(timer)},[term]);
 const params=new URLSearchParams({page:String(page),limit:'20',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});if(q)params.set('q',q);if(from)params.set('from',from);if(to)params.set('to',to);
 const L=useLoad(()=>api<ActivityPage>(`/activity?${params.toString()}`),[page,q,from,to]);
 const dateTime=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
 const first=L.d&&L.d.total?(L.d.page-1)*L.d.limit+1:0,last=L.d?Math.min(L.d.page*L.d.limit,L.d.total):0,pages=L.d?Math.max(1,Math.ceil(L.d.total/L.d.limit)):1;
 const clear=()=>{setTerm('');setQ('');setFrom('');setTo('');setPage(1)};
 return <div className="page-stack">
  <div className="page-heading"><div><p className="eyebrow">SECURITY &amp; OVERSIGHT</p><h1 className="page-title">Activity log</h1><p className="page-description">{isSuper?'Review activity across your organization.':'Review your recent account activity.'}</p></div><div className="activity-total"><span className="activity-total-icon">↗</span><span><b>{L.d?.total??'—'}</b><small>{isSuper?'events recorded':'your events'}</small></span></div></div>
  <div className="activity-filters"><label className="activity-search"><span aria-hidden="true">⌕</span><input aria-label="Search activity" placeholder="Search people, actions or records…" value={term} onChange={e=>setTerm(e.target.value)}/></label>
   <label className="date-filter"><span>From</span><input className={I} aria-label="From date" type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label>
   <label className="date-filter"><span>To</span><input className={I} aria-label="To date" type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label>
   {(q||from||to)&&<button className={G+' clear-filters'} onClick={clear}>Clear filters</button>}</div>
  <Err m={L.err}/>
  <section className="activity-card" aria-label="Activity events">
   <div className="activity-card-heading"><div><h2>Recent activity</h2><p>{L.d?`Showing ${first}–${last} of ${L.d.total} events`:'Loading activity…'}</p></div><span className="activity-live"><i/>Latest first</span></div>
   {!L.d&&!L.err&&<div role="status" aria-label="Loading activity" className="activity-list">{Array.from({length:5},(_,i)=><div className="activity-row" key={i}><Skeleton className="h-10 w-10 rounded-xl"/><div className="activity-row-content"><Skeleton className="h-4 w-3/5"/><Skeleton className="mt-2 h-3 w-2/5"/></div></div>)}</div>}
   {L.d&&!L.d.items.length&&!L.err&&<div className="activity-empty"><span>⌕</span><h3>No activity found</h3><p>Try adjusting your search or date range.</p></div>}
   {!!L.d?.items.length&&<div className="activity-list"><ActivityRows items={L.d.items} dateTime={dateTime}/></div>}
   {L.d&&L.d.total>0&&<div className="activity-pagination"><span>Page {page} of {pages}</span><div><button className={G} disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><button className={G} disabled={page>=pages} onClick={()=>setPage(value=>value+1)}>Next</button></div></div>}
  </section>
 </div>
}
function NewStaff({onClose,onDone}:{onClose:()=>void;onDone:(e:string,p:string)=>void}){
 const R=useLoad(()=>api<Role[]>('/roles'),[]);
 const f=useForm({name:'',email:'',employeeCode:'',mobile:'',roleId:''},async v=>{const b:Record<string,string>={};for(const k in v) if(v[k].trim()) b[k]=v[k];const r=await api('/staff','POST',b);onDone(r.staff.email,r.temporaryPassword)});
 const T=(k:string,l:string)=><Field label={l} err={f.f[k]}><input className={I} value={f.v[k]} onChange={f.set(k)}/></Field>;
 return <Modal title="Add a staff member" onClose={onClose}><form onSubmit={f.go} className="space-y-3"><Err m={f.e}/>{T('name','Full name *')}{T('email','Work email *')}<div className="grid grid-cols-2 gap-3">{T('employeeCode','Employee code *')}{T('mobile','Mobile')}</div>
  <Field label="Role *" err={f.f.roleId}><select className={I} value={f.v.roleId} onChange={f.set('roleId')}><option value="">{R.d?'Choose a role…':'Loading roles…'}</option>{R.d?.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
  <div className="flex justify-end gap-2"><button type="button" className={G} onClick={onClose}>Cancel</button><button className={B} disabled={f.busy}>Create</button></div></form></Modal>}
function Roles(){
 const R=useLoad(()=>api<Role[]>('/roles'),[]);const M=useLoad(()=>api<{key:string;name:string;perms:{key:string;label:string;scope_capable:boolean}[]}[]>('/meta/permissions'),[]);
 const [sel,setSel]=useState<Role|null>(null);const [g,setG]=useState<Record<string,string>>({});const [msg,setMsg]=useState('');const [msgError,setMsgError]=useState(false);const [name,setName]=useState('');const [createError,setCreateError]=useState('');const [activeModule,setActiveModule]=useState('');
 const pick=useCallback((r:Role)=>{setSel(r);setG(Object.fromEntries(r.grants.map(x=>[x.key,x.scope])));setMsg('');setMsgError(false)},[]);
 const modules=M.d??[],selectedModule=modules.find(module=>module.key===activeModule)??modules[0];
 const selectedCount=(module:{perms:{key:string}[]})=>module.perms.filter(permission=>permission.key in g).length;
 const setModuleAccess=(module:{perms:{key:string;scope_capable:boolean}[]},enabled:boolean)=>{
  const next={...g};
  for(const permission of module.perms){if(enabled)next[permission.key]=next[permission.key]??'all';else delete next[permission.key]}
  setG(next);setMsg('');setMsgError(false);
 };
 const moveModuleTab=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!modules.length)return;
  event.preventDefault();
  const index=Math.max(0,modules.findIndex(module=>module.key===selectedModule?.key));
  const nextIndex=event.key==='Home'?0:event.key==='End'?modules.length-1:(index+(event.key==='ArrowRight'?1:-1)+modules.length)%modules.length;
  setActiveModule(modules[nextIndex].key);
  document.getElementById(`role-tab-${modules[nextIndex].key}`)?.focus();
 };
 const unsaved=!!sel&&JSON.stringify(Object.entries(g).sort(([a],[b])=>a.localeCompare(b)))!==JSON.stringify(sel.grants.map(grant=>[grant.key,grant.scope]).sort(([a],[b])=>String(a).localeCompare(String(b))));
 const saveAccess=async()=>{
  if(!sel)return;
  const grants=Object.entries(g).map(([key,scope])=>({key,scope}));
  setMsg('');
  try{
   await api(`/roles/${sel.id}/permissions`,'PUT',{grants});
   setSel({...sel,grants});
   R.reload();
   setMsgError(false);
   setMsg(`Access permissions saved for ${sel.name}. This change was recorded in the activity log.`);
  }catch(error){setMsgError(true);setMsg(error instanceof Error?error.message:'Could not save access permissions. Please try again.')}
 };
 const addRole=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setCreateError('');try{await api('/roles','POST',{name});setName('');R.reload()}catch(error){setCreateError(error instanceof ApiError?(error.fields.name??error.message):'Network problem. Please try again.')}};
 return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">TEAM &amp; ACCESS</p><h1 className="page-title">Roles &amp; access</h1><p className="page-description">Choose a role, then configure access one area at a time.</p></div></div><Err m={R.err||M.err}/><div className="roles-layout">
  <section className="role-list-card" aria-label="Roles"><div className="card-heading"><h2>Roles</h2><span>{R.d?.length??'—'}</span></div>{R.d?.map(r=><button key={r.id} onClick={()=>pick(r)} className={`role-option ${sel?.id===r.id?'is-selected':''}`} aria-pressed={sel?.id===r.id}><span className="role-avatar">{r.name.slice(0,1).toUpperCase()}</span><span className="role-option-copy"><b>{r.name}</b><span>{r.staff_count} staff</span></span><span className="role-chevron">›</span></button>)}{!R.d&&!R.err&&<div role="status" aria-label="Loading roles" className="space-y-3 py-3">{[1,2,3].map(n=><div key={n} className="space-y-2 px-2 py-2"><Skeleton className="h-4 w-28"/><Skeleton className="h-3 w-16"/></div>)}</div>}
   <form className="role-create" onSubmit={addRole} noValidate><div className="role-create-field"><input className={I} placeholder="New role name" aria-label="New role name" aria-invalid={!!createError} aria-describedby={createError?'role-name-error':undefined} value={name} onChange={e=>{setName(e.target.value);if(createError)setCreateError('')}}/>{createError&&<p id="role-name-error" className="role-create-error" role="alert">{createError}</p>}</div><button className={B}>Add role</button></form></section>
  <section className="role-permissions-card" aria-label="Role permissions">{!sel?<Empty t="Choose a role to configure its access."/>:<>
   <div className="role-editor-heading"><div><p className="eyebrow">ACCESS SETTINGS</p><h2>{sel.name}</h2><p>{sel.is_system?'Built-in roles are read-only.':'Select the areas and actions this role can access.'}</p></div><div className="role-editor-actions">{unsaved&&<span className="role-unsaved">Unsaved changes</span>}{!sel.is_system&&<button className="role-delete-button" onClick={()=>confirm('Delete this role?')&&api('/roles/'+sel.id,'DELETE').then(()=>{setSel(null);setMsgError(false);setMsg('Role deleted.');R.reload()}).catch(error=>{setMsgError(true);setMsg(error instanceof Error?error.message:'Could not delete the role.')})}>Delete role</button>}<button className={B} disabled={sel.is_system||!unsaved} onClick={saveAccess}>Save access</button></div></div>
   {msg&&<p className={`role-feedback ${msgError?'role-feedback-error':''}`} role={msgError?'alert':'status'}>{msg}</p>}
   {modules.length>0&&<div className="permission-workspace">
    <div className="permission-tabs" role="tablist" aria-label="Permission modules" onKeyDown={moveModuleTab}>{modules.map(module=><button key={module.key} id={`role-tab-${module.key}`} role="tab" aria-selected={selectedModule?.key===module.key} aria-controls="role-module-panel" tabIndex={selectedModule?.key===module.key?0:-1} className={`permission-tab ${selectedModule?.key===module.key?'is-active':''}`} onClick={()=>setActiveModule(module.key)}>{module.name}<span>{selectedCount(module)}/{module.perms.length}</span></button>)}</div>
    {selectedModule&&<section id="role-module-panel" role="tabpanel" aria-labelledby={`role-tab-${selectedModule.key}`} className="permission-module-panel">
     <header className="permission-module-heading"><div><h3>{selectedModule.name} access</h3><p>{selectedCount(selectedModule)} of {selectedModule.perms.length} permissions enabled</p></div>{!sel.is_system&&<div className="permission-bulk-actions"><button type="button" onClick={()=>setModuleAccess(selectedModule,true)} disabled={selectedCount(selectedModule)===selectedModule.perms.length}>Select all</button><button type="button" onClick={()=>setModuleAccess(selectedModule,false)} disabled={!selectedCount(selectedModule)}>Deselect all</button></div>}</header>
     <div className="permission-list">{selectedModule.perms.map(permission=><div key={permission.key} className={`permission-toggle-row ${permission.key in g?'has-access':''}`}><div className="permission-toggle-copy"><b>{permission.label}</b><small>{permission.scope_capable?'Choose whether this applies to every record or assigned records.':'Allow this role to perform this action.'}</small></div><label className="permission-switch"><span className="sr-only">{permission.label}</span><input type="checkbox" checked={permission.key in g} disabled={sel.is_system} onChange={event=>{const next={...g};if(event.target.checked)next[permission.key]='all';else delete next[permission.key];setG(next);setMsg('');setMsgError(false)}}/><span aria-hidden="true" className="permission-switch-track"/></label>{permission.scope_capable&&permission.key in g&&<select className={I+' permission-scope'} aria-label={`${permission.label} scope`} disabled={sel.is_system} value={g[permission.key]} onChange={event=>{setG({...g,[permission.key]:event.target.value});setMsg('');setMsgError(false)}}><option value="all">All clients</option><option value="own">Assigned clients only</option></select>}</div>)}
      {!selectedModule.perms.length&&<Empty t="There are no permissions in this module yet."/>}
     </div>
    </section>}
   </div>}
  </>}</section></div></div>}
export default function App(){
 const [me,setMe]=useState<Me|null|undefined>(undefined);const [page,setPage]=useState(location.hash.slice(1)||'dashboard');
 const load=useCallback(()=>{api<Me>('/me').then(setMe).catch(()=>setMe(null))},[]);useEffect(load,[load]);
 useEffect(()=>{const h=()=>setPage(location.hash.slice(1)||'dashboard');addEventListener('hashchange',h);return()=>removeEventListener('hashchange',h)},[]);
 if(me===undefined) return <AppSkeleton/>;if(!me) return <Login onDone={()=>{setPage('dashboard');location.hash='dashboard';load()}}/>;if(me.must_change_password) return <ChangePw onDone={()=>{setPage('dashboard');location.hash='dashboard';load()}}/>;
 const can=(k:string)=>me.perms.some(p=>p.key===k);const nav=[{id:'dashboard',label:'Dashboard',show:can('clients.client.view')},{id:'clients',label:'Clients',show:can('clients.client.view')},{id:'staff',label:'Staff',show:can('access.staff.view')||can('access.staff.manage')},{id:'roles',label:'Roles & access',show:can('access.role.view')||can('access.role.manage')},{id:'activity',label:'Activity log',show:can('access.audit.view')},{id:'profile',label:'Profile',show:true}].filter(n=>n.show);
 const cur=nav.find(n=>n.id===page)?page:nav.find(n=>n.id==='dashboard')?.id??nav[0]?.id;
 const navIcon=(id:string)=><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">{id==='clients'?<><path strokeLinecap="round" strokeLinejoin="round" d="M3.5 20h17M5 20V8l7-4 7 4v12M9 20v-6h6v6M8 9h.01M12 9h.01M16 9h.01"/></>:id==='staff'?<><circle cx="9" cy="8" r="3"/><path strokeLinecap="round" strokeLinejoin="round" d="M3.5 20v-1a5.5 5.5 0 0111 0v1M16 5.5a3 3 0 010 5.8M17 14a5 5 0 013.5 4.8V20"/></>:id==='activity'?<><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h3l2-6 4 12 2-6h5"/><circle cx="12" cy="12" r="9"/></>:<><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2 2.2 3-.1.8 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.8 2.9-3-.1L12 22l-2-2.2-3 .1-.8-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.8-2.9 3 .1L12 3z"/><circle cx="12" cy="12" r="3"/></>}</svg>;
 return <div className="app-shell"><aside className="app-sidebar"><a className="sidebar-brand" href="#"><span className="brand-mark">B</span><span>Business <b>MIS</b><small>OPERATIONS PORTAL</small></span></a><p className="nav-caption">WORKSPACE</p><nav className="app-nav">{nav.map(n=><a key={n.id} href={'#'+n.id} className={`nav-link ${cur===n.id?'is-active':''}`}>{navIcon(n.id)}<span>{n.label}</span>{cur===n.id&&<span className="nav-active-mark"/>}</a>)}</nav><div className="sidebar-footer"><span className="sidebar-footer-mark">✓</span><span><b>Workspace secure</b><small>Your data is protected</small></span></div></aside>
  <div className="app-main"><header className="topbar"><div className="topbar-context"><span className="topbar-kicker">BUSINESS MANAGEMENT</span><span className="topbar-divider">/</span><span>{nav.find(n=>n.id===cur)?.label??'Workspace'}</span></div><div className="topbar-user"><span className="user-avatar">{me.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()}</span><span className="user-copy"><b>{me.name}</b><small>{me.role??'Team member'}</small></span><button className={G+' sign-out'} onClick={()=>api('/auth/logout','POST').then(()=>setMe(null))}>Sign out</button></div></header>
  <main className="app-content">{!cur?<Empty t="Your role has no menu access yet. Ask an administrator."/>:cur==='dashboard'?<Dashboard name={me.name} can={can}/>:cur==='clients'?<Clients can={can}/>:cur==='staff'?<Staff can={can}/>:cur==='roles'?<Roles/>:cur==='activity'?<Activity isSuper={me.is_super}/>:<Profile me={me} onSaved={async()=>setMe(await api<Me>('/me'))}/>}</main></div></div>}
