import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';
const root=path.resolve(import.meta.dirname,'..');
export const releasePaths=['server','public','private','source','test','package.json','build.cjs','api-transform.cjs','province-transform.cjs','dashboard-transform.cjs','recommendation-transform.cjs','map-transform.cjs','README.md','SECURITY-REVIEW.md','WAREHOUSE-FOLLOWUP.md','Dockerfile','compose.yaml','Caddyfile','.gitignore','.dockerignore','.env.example'];
let config={};try{config=parseEnv(await fs.readFile(path.join(root,'.env'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const secrets=Object.entries(config).filter(([k,v])=>/KEY|PASSWORD|SECRET|PRICE_|MAP_CSV/.test(k)&&v.length>=12).map(([,v])=>v);
const forbidden=/(?:^|[\/])(?:data|node_modules|\.git)(?:[\/]|$)|\.sqlite(?:-|$)|\.log$|(?:^|[\/])\.env(?:\.|$)|-report\./i;
let checked=0;const failures=[];
async function scan(relative){const full=path.join(root,relative),stat=await fs.lstat(full);if(stat.isSymbolicLink()){failures.push(relative+': symbolic link');return;}if(stat.isDirectory()){for(const name of await fs.readdir(full))await scan(path.join(relative,name));return;}if(relative!=='.env.example'&&forbidden.test(relative)){failures.push(relative+': private/runtime file');return;}
 const text=await fs.readFile(full,'utf8');checked++;
 if(secrets.some(s=>text.includes(s))||/sk-[a-f0-9]{64}\b/i.test(text)||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push(relative+': secret detected');
 if(/docs\.google\.com\/spreadsheets\/d\/(?:e\/)?(?:2PACX-[A-Za-z0-9_-]+|[A-Za-z0-9_-]{30,})/.test(text))failures.push(relative+': old published data source');
}
for(const p of releasePaths)await scan(p);
if(failures.length){console.error('Release blocked:\n'+failures.join('\n'));process.exitCode=1;}else console.log('Release check passed: '+checked+' allowlisted files, no configured secrets or runtime data files. This is not a guarantee of total security.');
