import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import http from 'node:http';
import {createApp} from '../server/app.mjs';
import {passwordHash,passwordMatches,seal,unseal,totp,verifyOTP} from '../server/crypto.mjs';
const password='Only a fictitious test password 123!',hash=await passwordHash(password),origin='http://127.0.0.1:8080';
async function fixture(options={}){
 const site=options.origin||origin,host=new URL(site).host;
 const directory=await mkdtemp(path.join(os.tmpdir(),'vt-secure-'));
 const calls=[],server=await createApp({origin,passwordHash:hash,dataKey:randomBytes(32).toString('base64'),warehouseKey:'test-secret-never-send-to-browser',dataDir:directory,sourceIDs:['ALLOWED'],fetcher:async(url,opt)=>{calls.push({url:String(url),method:opt?.method,authorization:opt?.headers?.Authorization});if(String(url).endsWith('/auth/api_key_login'))return Response.json({accessToken:{token:'upstream-token',expiresAt:new Date(Date.now()+3600000).toISOString()}});return Response.json({data:[{id:1,CustomerCode:'C1',CustomerName:'Test',Phone:'sensitive',IdCardMember:'sensitive'}],_page:1,_totalData:1,_hasNextPage:false});},...options});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const request=(url,options={})=>new Promise((resolve,reject)=>{const req=http.request(base+url,{method:options.method||'GET',headers:{Host:host,...options.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]))})));});req.on('error',reject);req.end(options.body);});
 const login=async()=>{const r=await request('/api/login',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify({username:'Admin',password,...(options.totpSecret?{otp:totp(options.totpSecret)}:{})})});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],...(await r.json())};};
 return {request,login,calls,directory,close:async()=>{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}};
}
test('passwords, encryption integrity and one-time MFA codes',async()=>{
 assert(await passwordMatches(password,hash));assert(!await passwordMatches(password+'x',hash));
 const key=randomBytes(32),encrypted=seal({private:'business value'},key);assert(!encrypted.includes(Buffer.from('business value')));assert.deepEqual(unseal(encrypted,key),{private:'business value'});encrypted[30]^=1;assert.throws(()=>unseal(encrypted,key));
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';assert.equal(totp(secret,1),'287082');assert.equal(verifyOTP(secret,'287082',-1,30000),1);assert.equal(verifyOTP(secret,'287082',1,30000),null);
});
test('anonymous users cannot read app, data, source, backups or config; cross-site requests blocked',async()=>{
 const f=await fixture();try{for(const url of ['/app','/private/app.html','/api/storage','/.env','/server/app.mjs','/data/private.sqlite','/map','/map-assets/leaflet.js','/api/map/dealers?province=34']){const r=await f.request(url);assert.equal(r.status,401,url);assert(!((await r.text()).includes('test-secret')));}
 const page=await f.request('/');assert.equal(page.status,200);assert(!(await page.text()).includes('sales-source'));
 const cross=await f.request('/api/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 const host=await f.request('/',{headers:{Host:'attacker.example'}});assert.equal(host.status,421);
 }finally{await f.close();}
});
test('map shares Admin auth and CSP; services require CSRF and reject arbitrary hosts',async()=>{
 const f=await fixture();try{const s=await f.login(),headers={Cookie:s.cookie,Origin:origin,'Content-Type':'application/json'};const r=await f.request('/map',{headers});assert.equal(r.status,200);const html=await r.text();assert(!html.includes('APP_PASSWORD_HASH'));assert(!html.includes('docs.google.com/spreadsheets'));assert(html.includes('data-map-act'));assert(!html.includes('onclick="A.'));assert(r.headers.get('content-security-policy').includes("connect-src 'self'"));assert(!r.headers.get('content-security-policy').includes("script-src 'unsafe-inline'"));
 let denied=await f.request('/api/map/service',{method:'POST',headers,body:JSON.stringify({url:'https://example.com/'})});assert.equal(denied.status,403);denied=await f.request('/api/map/service',{method:'POST',headers:{...headers,'X-CSRF-Token':s.csrf},body:JSON.stringify({url:'http://127.0.0.1/private'})});assert.equal(denied.status,400);assert.equal(f.calls.length,0);
 denied=await f.request('/api/map/dealers',{headers});assert.equal(denied.status,503);
 }finally{await f.close();}
});
test('authenticated storage requires CSRF, encrypts disk and rejects conflicting updates',async()=>{
 const f=await fixture();try{const s=await f.login();assert(!s.cookie.includes(password));const headers={Cookie:s.cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':s.csrf};
 let r=await f.request('/api/storage',{method:'PUT',headers:{...headers,'X-CSRF-Token':'bad'},body:JSON.stringify({revision:0,values:{TEST:'private test business value'}})});assert.equal(r.status,403);
 r=await f.request('/api/storage',{method:'PUT',headers,body:JSON.stringify({revision:0,values:{TEST:'private test business value'}})});assert.equal(r.status,200);
 r=await f.request('/api/storage',{headers:{Cookie:s.cookie}});assert.deepEqual(await r.json(),{revision:1,values:{TEST:'private test business value'}});
 r=await f.request('/api/storage',{method:'PUT',headers,body:JSON.stringify({revision:0,values:{TEST:'overwrite'}})});assert.equal(r.status,409);
 for(const suffix of ['','-wal']){let bytes;try{bytes=await readFile(path.join(f.directory,'private.sqlite'+suffix));}catch{continue;}assert(!bytes.includes(Buffer.from('private test business value')));assert(!bytes.includes(Buffer.from(password)));assert(!bytes.includes(Buffer.from(s.cookie.split('=')[1])));}
 }finally{await f.close();}
});
test('Warehouse credentials stay server-side; response fields minimized; SSRF and write routes rejected',async()=>{
 const f=await fixture();try{const s=await f.login(),headers={Cookie:s.cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'};
 let r=await f.request('/api/warehouse/read',{method:'POST',headers,body:JSON.stringify({url:'https://warehouseapi.huonganhgroup.vn/v1/wh_customers/paginate?_page=1&_limit=2'})});assert.equal(r.status,200);const body=await r.json();assert.equal(body.data[0].CustomerName,'Test');assert.equal(body.data[0].Phone,undefined);assert.equal(body.data[0].IdCardMember,undefined);assert(!JSON.stringify(body).includes('upstream-token'));assert.equal(f.calls.length,2);assert.equal(f.calls[1].authorization,'Bearer upstream-token');
 for(const url of ['http://127.0.0.1/internal','https://evil.example/v1/wh_customers/paginate','https://warehouseapi.huonganhgroup.vn/v1/users/paginate','https://warehouseapi.huonganhgroup.vn/v1/wh_customers/bulk','https://warehouseapi.huonganhgroup.vn/v1/wh_customers/paginate?_page=1&_limit=200&secret=yes']){r=await f.request('/api/warehouse/read',{method:'POST',headers,body:JSON.stringify({url})});assert.equal(r.status,400,url);}
 const before=f.calls.length;r=await f.request('/api/source/read',{method:'POST',headers,body:JSON.stringify({url:'https://evil.example/'})});assert.equal(r.status,400);assert.equal(f.calls.length,before);
 assert(f.calls.every(c=>!c.method||c.method==='POST')); // Only login POST reaches upstream; resources use GET.
 }finally{await f.close();}
});
test('logout and password change invalidate sessions; protected scripts use CSP nonce',async()=>{
 const f=await fixture();try{let s=await f.login();let headers={Cookie:s.cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'};
 let r=await f.request('/app',{headers:{Cookie:s.cookie}});assert.equal(r.status,200);const csp=r.headers.get('content-security-policy'),html=await r.text();assert(csp.includes("connect-src 'self'"));assert(csp.includes('frame-ancestors'));assert(!html.includes('__CSP_NONCE__'));assert(!html.includes('test-secret-never-send-to-browser'));assert(!html.includes('id="wh-key"'));assert(html.includes('VTSecureStorage'));
 r=await f.request('/api/logout',{method:'POST',headers});assert.equal(r.status,200);r=await f.request('/api/storage',{headers:{Cookie:s.cookie}});assert.equal(r.status,401);
 s=await f.login();headers={...headers,Cookie:s.cookie,'X-CSRF-Token':s.csrf};r=await f.request('/api/account/password',{method:'POST',headers,body:JSON.stringify({currentPassword:password,password:'New fictional test password 456!'})});assert.equal(r.status,200);r=await f.request('/api/session',{headers:{Cookie:s.cookie}});assert.equal(r.status,401);
 }finally{await f.close();}
});
test('MFA required on non-local origin and cookie flags are hardened',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'vt-secure-'));try{await assert.rejects(createApp({origin:'https://app.example.com',passwordHash:hash,dataKey:randomBytes(32).toString('base64'),dataDir:directory}),/hai bước/);}finally{await rm(directory,{recursive:true,force:true});}
 const f=await fixture();try{const r=await f.request('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'Admin',password})});const cookie=r.headers.get('set-cookie');assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));assert(cookie.includes('Path=/'));}finally{await f.close();}
});
test('login throttling persists after wrong attempts',async()=>{
 const f=await fixture();try{for(let i=0;i<10;i++){const r=await f.request('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'unknown',password:'x'})});assert.equal(r.status,401);}const r=await f.request('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'Admin',password})});assert.equal(r.status,429);}finally{await f.close();}
});
test('production enforces MFA and Secure host cookie; OTP replay is rejected',async()=>{
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',site='https://app.example.com',f=await fixture({origin:site,totpSecret:secret});
 try{const b=JSON.stringify({username:'Admin',password,otp:totp(secret)}),options={method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:b};const r=await f.request('/api/login',options);assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert(cookie.startsWith('__Host-vt_session='));assert(cookie.includes('; Secure'));assert(r.headers.get('strict-transport-security'));const again=await f.request('/api/login',options);assert.equal(again.status,401);}finally{await f.close();}
});
test('source proxy rejects redirect to internal network before following it',async()=>{
 let calls=0;const f=await fixture({fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});}});
 try{const s=await f.login();const r=await f.request('/api/source/read',{method:'POST',headers:{Cookie:s.cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'},body:JSON.stringify({url:'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=21&lon=105'})});assert.equal(r.status,502);assert.equal(calls,1);}finally{await f.close();}
});
test('source JSON is passed through without double encoding; no remote script execution',async()=>{
 const f=await fixture({fetcher:async()=>Response.json({ok:true,latest:{id:123}})});try{const s=await f.login(),r=await f.request('/api/source/read',{method:'POST',headers:{Cookie:s.cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'},body:JSON.stringify({url:'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=21&lon=105'})});assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,latest:{id:123}});}finally{await f.close();}
});
test('deleted/unavailable Google Sheets cannot affect API catalogue or order snapshot',async()=>{
 const calls=[];const f=await fixture({fetcher:async(input)=>{const u=new URL(input);calls.push(u.href);if(u.hostname!=='warehouseapi.huonganhgroup.vn')throw Error('Google Sheets unavailable');if(u.pathname.endsWith('api_key_login'))return Response.json({accessToken:{token:'mock-token',expiresAt:new Date(Date.now()+3600000).toISOString()}});
 const resource=u.pathname.split('/')[2],records={wh_products:[{id:1,ProductSku:'S1',ProductName:'Tủ lạnh Sharp',ModelCode:'M1',BrandCode:'SHARP'}],wh_customers:[{id:1,CustomerCode:'C1',CustomerName:'Đại lý thử'}],wh_stock_reports:[{id:1,ProductSku:'S1',CloseInventory:'7',updateLatestAt:'2026-10-31T00:00:00Z'}],wh_promotions:[],wh_promotion_details:[],wh_sales_orders:[{id:1,AppOrderId:'A1',OrderRefNo:'SO1',DocDate:'2026-10-24T00:00:00Z',CustomerCode:'C1',TotalAmount:'108000000',TotalGoodsAmount:'120000000',TotalDiscount:'12000000',temp:{TotalLine:1,DocStatus:'9'}}],wh_sales_order_details:[{id:1,AppOrderId:'A1',ProductCode:'S1',Quantity:'1',UnitPrice:'120000000',IsGift:false}]};const data=records[resource];return Response.json({data,_page:1,_totalData:data.length,_hasNextPage:false});}});
 try{const s=await f.login(),headers={Cookie:s.cookie,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'};let denied=await f.request('/api/warehouse/history',{headers});assert.equal(denied.status,400);assert.equal(calls.length,0,'no upstream order request before selecting region');denied=await f.request('/api/warehouse/snapshot',{method:'POST',headers,body:JSON.stringify({start:'2026-10-01',end:'2026-10-31'})});assert.equal(denied.status,400);assert.equal(calls.length,0);let r=await f.request('/api/warehouse/catalog',{headers});assert.equal(r.status,200);assert.equal((await r.json()).items[0].stock,7);r=await f.request('/api/warehouse/snapshot',{method:'POST',headers,body:JSON.stringify({start:'2026-10-01',end:'2026-10-31',province:'all'})});assert.equal(r.status,200);const d=await r.json();assert.equal(d.totalAmount,108000000);assert.equal(d.lines[0].amount,108000000);assert.equal(d.lines[0].classification,'auto');assert(d.lines[0].vat);const before=calls.length;r=await f.request('/api/source/read',{method:'POST',headers,body:JSON.stringify({url:'https://docs.google.com/spreadsheets/d/ALLOWED/export?format=csv'})});assert.equal(r.status,400);assert.equal(calls.length,before);assert(calls.every(v=>new URL(v).hostname==='warehouseapi.huonganhgroup.vn'));}finally{await f.close();}
});

test('map endpoint uses Warehouse header money and sheet coordinates independently of program province',async()=>{
 const calls=[];const f=await fixture({mapCSVURL:'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv',fetcher:async(url,opt)=>{const u=new URL(url);calls.push(u.pathname);if(u.hostname==='docs.google.com')return new Response('Code,Name,Address,Lon,Lat,Revenue\nC1,Dealer,Thái Bình,106.2,20.4,999999999\nC1,Dealer,Thái Bình,106.2,20.4,999999999');if(u.pathname.endsWith('/auth/api_key_login'))return Response.json({accessToken:{token:'token',expiresAt:new Date(Date.now()+3600000).toISOString()}});const data=u.pathname.includes('wh_customers')?[{id:1,CustomerCode:'C1',CustomerName:'A',ProvinceId:'34'},{id:2,CustomerCode:'C2',CustomerName:'B',ProvinceId:'33'}]:[{id:3,AppOrderId:'O1',CustomerCode:'C1',DocDate:'2024-02-01',TotalAmount:'108000'},{id:4,AppOrderId:'O2',CustomerCode:'C2',DocDate:'2024-02-29',TotalAmount:'50000'}];return Response.json({data,_page:Number(u.searchParams.get('_page')),_totalData:data.length,_hasNextPage:false});}});
 try{const session=await f.login(),headers={Cookie:session.cookie};const r=await f.request('/api/map/dealers?type=month&year=2024&part=2',{headers});assert.equal(r.status,200);const d=await r.json();assert.equal(d.data[0].s,108000);assert.equal(d.unlocated[0].s,50000);assert.equal(d.totals.totalAmount,158000);assert.equal(d.duplicateCodes,1);assert.equal(d.period.end,'2024-02-29');assert(!calls.some(p=>p.includes('wh_sales_order_details')));const bad=await f.request('/api/map/dealers?type=bad',{headers});assert.equal(bad.status,400);}finally{await f.close();}
});
