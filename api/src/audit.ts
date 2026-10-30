export const audit=(q:{query:Function},actor:string|null,action:string,entity?:string,entityId?:string,detail?:unknown,ip?:string)=>
 q.query(`insert into mis.audit_log(actor_staff_id,actor_name,target_name,action,entity,entity_id,detail,ip)
  values($1,(select name from mis.staff where id=$1),coalesce($7::jsonb->>'name',
   case $3 when 'tenant' then (select name from core.tenants where id::text=$4)
    when 'staff' then (select name from mis.staff where id::text=$4)
    when 'role' then (select name::text from mis.roles where id::text=$4) end),$2,$3,$4,$5,$6)`,
 [actor,action,entity??null,entityId??null,detail?JSON.stringify(detail):null,ip??null,detail?JSON.stringify(detail):null]);

const ACTIONS:Record<string,{verb:string;target?:string}>={
 'login.success':{verb:'logged in'},
 'login.failure':{verb:'attempted to sign in unsuccessfully'},
 'logout':{verb:'signed out'},
 'password.change':{verb:'changed their password'},
 'profile.update':{verb:'updated their profile information'},
 'role.create':{verb:'added a new role',target:'role'},
 'role.permissions':{verb:'updated permissions for role',target:'role'},
 'role.delete':{verb:'deleted role',target:'role'},
 'staff.create':{verb:'added a new staff member',target:'staff member'},
 'staff.status':{verb:'updated the status of staff member',target:'staff member'},
 'client.create':{verb:'added a new client',target:'client'},
 'client.reassign':{verb:'reassigned client',target:'client'},
};

export function auditSummary(action:string,actorName:string|null,targetName:string|null,isSelf:boolean,status?:string|null){
 if(action==='login.failure'&&!actorName) return 'An unsuccessful sign-in attempt was made';
 if(action==='profile.update') return isSelf?'You updated your profile information':`${actorName??'Former staff member'} updated their profile information`;
 const event=ACTIONS[action]??{verb:'updated',target:'record'};
 const actor=isSelf?'You':actorName??'Former staff member';
 const detail=action==='staff.status'&&status?` (${status.replaceAll('_',' ')})`:'';
 return `${actor} ${event.verb}${targetName?` ${targetName}`:event.target?` ${event.target}`:''}${detail}`;
}
