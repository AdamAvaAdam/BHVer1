const fs=require('node:fs'),path=require('node:path');
const apiTransform=require('./api-transform.cjs');
const root=__dirname,parent=path.dirname(root),input=fs.existsSync(path.join(root,'source/legacy.html'))?path.join(root,'source/legacy.html'):path.join(parent,'viet-tuan-tro-ly-warehouse.html');let html=fs.readFileSync(input,'utf8');
const bridge=String.raw`<script>
window.VTSecureStorage=parent.VTSecureStorage;window.VTSecureRequest=parent.VTSecureRequest;
Object.defineProperty(window,'localStorage',{value:window.VTSecureStorage,configurable:false});
const vtNativeFetch=window.fetch.bind(window);
window.fetch=async function(input,options={}){
 const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(value,location.href==='about:srcdoc'?parent.location.href:location.href);
 if(url.origin===location.origin || url.origin===parent.location.origin)return vtNativeFetch(input,options);
 if(options.method&&options.method.toUpperCase()!=='GET')throw Error('Nguồn đồng bộ ngoài đã được thay bằng lưu trữ bảo mật trên máy chủ.');
 const r=await window.VTSecureRequest('/api/source/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.href})});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Chưa đọc được nguồn.');}return r;
};
</script>`;
const inject=s=>s.includes('<head>')?s.replace('<head>','<head>'+bridge):s.replace(/<html[^>]*>/,m=>m+bridge);
const sources=new Set(),scripts=new Set();
for(const id of ['sales-source','promo-source']){
 const re=new RegExp('(<script id="'+id+'"[^>]*>)([\\s\\S]*?)(<\\/script>)');
 const match=html.match(re);let content=JSON.parse(match[2]);
 for(const m of content.matchAll(/docs\.google\.com\/spreadsheets\/d\/(?:e\/)?([A-Za-z0-9_-]+)/g))sources.add(m[1]);
 for(const m of content.matchAll(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/g))scripts.add(m[0]);
 content=content.replace(/function readPriceTabs\(url\)\{[\s\S]*?\n\}\);\}/,`async function readPriceTabs(url){
 const u=new URL(url);u.searchParams.set('callback','VT_PRICE_TABS');u.searchParams.set('_',Date.now());
 const response=await fetch(u.href,{cache:'no-store'});if(!response.ok)throw Error('Không đọc được nguồn bảng giá tự động.');
 const text=await response.text(),wrapped=text.match(/^\\s*VT_PRICE_TABS\\(([\\s\\S]*)\\);?\\s*$/);
 const data=JSON.parse(wrapped?wrapped[1]:text);if(!data?.ok)throw Error('Nguồn tự động trả dữ liệu không hợp lệ');return data;
}`);
 content=id==='sales-source'?apiTransform.sales(content):apiTransform.promo(content);
 content=inject(content);
 content=content.replace(/<script(?![^>]*type="application\/json")([^>]*)>/g,'<script nonce="__CSP_NONCE__"$1>');
 html=html.replace(re,(_,a,b,c)=>a+JSON.stringify(content).replace(/</g,'\\u003c')+c);
}
const core=fs.readFileSync(fs.existsSync(path.join(root,'source/client.js'))?path.join(root,'source/client.js'):path.join(parent,'warehouse-connector/client.js'),'utf8');
const start=core.indexOf('  constructor('),end=core.indexOf('  async list(');
if(start<0||end<0)throw Error('Warehouse client structure changed');
const secureCore=core.slice(0,start)+`  constructor(){}
  async request(path,options={}){
   if(options.method&&options.method!=='GET')throw Error('Ứng dụng chỉ đọc dữ liệu Warehouse.');
   const r=await root.VTSecureRequest('/api/warehouse/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:BASE+path})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Không đọc được Warehouse.');return d;
  }
  async login(){const r=await root.VTSecureRequest('/api/session');if(!r.ok)throw Error('Vui lòng đăng nhập Admin.');}
  disconnect(){}
`+core.slice(end);
if(!html.includes(core))throw Error('Warehouse source no longer matches build input');html=html.replace(core,secureCore);
html=html.replace('<label>Khóa API gốc <input id="wh-key" type="password" autocomplete="off" placeholder="Không phải mật khẩu tài khoản"></label> <button id="wh-login">Xác thực</button><p><small>Khóa và phiên xác thực chỉ giữ trong lần mở trang, không nằm trong HTML, sao lưu hoặc dữ liệu trình duyệt đã lưu.</small></p>','<p>Phiên Admin đã xác thực. Khóa Warehouse được giữ riêng ở máy chủ; bạn không cần nhập khóa trên trình duyệt.</p>');
html=html.replaceAll("['wh-read','wh-login','wh-stock','wh-commit']","['wh-read','wh-stock','wh-commit']");
html=html.replace(/ by\('wh-login'\)\.onclick=.*?;\r?\n/,'');
html=apiTransform.outer(html);
// Old Supabase configuration remains inert for backwards-compatible script bindings.
html=inject(html);html=html.replace('</head>','<style>details:has(#cloud-url){display:none!important}</style></head>');
html=html.replace(/<script(?![^>]*type="application\/json")(?![^>]*nonce=)([^>]*)>/g,'<script nonce="__CSP_NONCE__"$1>');
fs.mkdirSync(path.join(root,'private'),{recursive:true});fs.writeFileSync(path.join(root,'private/app.html'),html);fs.writeFileSync(path.join(root,'private/sources.json'),JSON.stringify({sheets:[],scripts:[],mode:'warehouse-only'},null,2));
if(/sk-[a-f0-9]{64}/i.test(html))throw Error('Secret detected in generated HTML');
console.log('Built protected app: legacy features retained; server-only Warehouse authentication and encrypted storage bridge.');

if(fs.existsSync(path.join(root,'source/map.html')))fs.writeFileSync(path.join(root,'private/map.html'),fs.readFileSync(path.join(root,'source/map.html'),'utf8').replace('/* MAP_UI_EXTENSION */',fs.readFileSync(path.join(root,'source/map-ui.js'),'utf8')));
