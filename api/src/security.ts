import {hash,verify} from '@node-rs/argon2';import {createHash,randomBytes} from 'node:crypto';import {z} from 'zod';
export const hashPw=(p:string)=>hash(p);export const verifyPw=(h:string,p:string)=>verify(h,p);
export const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export const tempPassword=()=>'Tmp-'+randomBytes(9).toString('base64url')+'7';
export const pwSchema=z.string().min(12,'Use at least 12 characters').max(128)
 .regex(/[A-Z]/,'Include an uppercase letter')
 .regex(/[a-z]/,'Include a lowercase letter')
 .regex(/\d/,'Include a number')
 .regex(/[^A-Za-z0-9]/,'Include a symbol');
