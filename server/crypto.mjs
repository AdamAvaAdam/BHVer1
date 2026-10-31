import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash,createCipheriv,createDecipheriv,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),params={N:131072,r:8,p:1,maxmem:256*1024*1024};
export const random=()=>randomBytes(32).toString('base64url');
export const hash=v=>createHash('sha256').update(v).digest('hex');
export async function passwordHash(value){const salt=randomBytes(16).toString('hex'),key=await scrypt(value,salt,64,params);return 'scrypt$'+salt+'$'+key.toString('hex');}
export async function passwordMatches(value,encoded){const [type,salt,hex]=String(encoded).split('$');if(type!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex))return false;const key=await scrypt(value,salt,64,params);return timingSafeEqual(key,Buffer.from(hex,'hex'));}
export function seal(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]);}
export function unseal(value,key){const buffer=Buffer.from(value),cipher=createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));cipher.setAuthTag(buffer.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(buffer.subarray(28)),cipher.final()]).toString('utf8'));}
export function totp(secret,step=Math.floor(Date.now()/30000)){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const i=alphabet.indexOf(c);if(i<0)throw Error('Invalid TOTP secret');bits+=i.toString(2).padStart(5,'0');}
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
export function verifyOTP(secret,code,lastStep=-1,now=Date.now()){if(!/^\d{6}$/.test(String(code)))return null;const center=Math.floor(now/30000);for(const n of [center,center-1,center+1])if(n>lastStep&&timingSafeEqual(Buffer.from(totp(secret,n)),Buffer.from(code)))return n;return null;}
