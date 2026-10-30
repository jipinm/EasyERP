export class ApiError extends Error{constructor(public status:number,public code:string,message:string,public fields:Record<string,string>={}){super(message)}}
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
 const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'mis'},body:body===undefined?undefined:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){const f:Record<string,string>={};(j.errors??[]).forEach((e:any)=>f[e.field]=e.message);throw new ApiError(r.status,j.code??'ERROR',j.message??'Request failed',f)}
 return j.data as T}
