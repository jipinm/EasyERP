import {makePool} from './db';import {createApp} from './app';
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
createApp(makePool()).listen(Number(process.env.PORT??3001),()=>console.log('MIS API on :'+(process.env.PORT??3001)));
