import {makePool} from './db';import {migrate,seedRoles,ensureSuper} from './bootstrap';
const pool=makePool();const cmd=process.argv[2];
try{ if(cmd==='migrate') await migrate(pool);
 else if(cmd==='seed'){await seedRoles(pool);const e=process.env.SUPER_EMAIL,p=process.env.SUPER_PASSWORD;
  if(e&&p) await ensureSuper(pool,e,p).catch(x=>console.log(String(x.message)));else console.log('Set SUPER_EMAIL and SUPER_PASSWORD to create the super administrator.')}
 else{console.error('usage: migrate | seed');process.exitCode=1}}
finally{await pool.end()}
