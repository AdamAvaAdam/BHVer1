const fs=require('node:fs'),zlib=require('node:zlib'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const payload=id=>JSON.parse(html.match(new RegExp('<script id="'+id+'" type="application/json">([\\s\\S]*?)<\\/script>'))[1]);
const app=zlib.gunzipSync(Buffer.from(payload('vt-app-document'),'base64')).toString();
const promo=JSON.parse(app.match(/<script id="promo-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const normalize=html.slice(html.indexOf('function vt({orders'),html.indexOf('function At(',html.indexOf('function vt({orders')));
const ctx=vm.createContext({U:{SOURCE:'warehouse:huonganh:v1',day:s=>s.slice(0,10)}});
vm.runInContext(`const j=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?Number(n):null;${normalize};globalThis.normalize=vt;`,ctx);
const run=code=>vm.runInContext(code,ctx);
const calculations=promo.slice(promo.indexOf('function tier('),promo.indexOf('const sharpStatus ='));
vm.runInContext(String.raw`
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const START='2026-10-22',TOUR_START='2026-10-23',SHARP_START='2026-10-01';
const ends={gift:'2026-10-31',travel:'2027-01-23',sharp:'2026-12-31'};const endFor=id=>ends[id];
let data={lines:[],customers:[],programExtensions:{}};
${calculations}
globalThis.tourAmount=tourAmount;globalThis.sharpGross=sharpGross;
`,ctx);
const product=(sku,brand)=>({ProductSku:sku,ProductName:'Sản phẩm '+sku,BrandCode:brand});
const makeSnapshot=(brands,total=155710000,options={})=>ctx.normalize({orders:[{AppOrderId:'O1',CustomerCode:'C1',DocDate:'2026-10-31',TotalAmount:total,TotalDiscount:100000,temp:{TotalLine:brands.length+(options.gift?1:0)}}],details:[...brands.map((brand,i)=>({id:'L'+i,AppOrderId:'O1',ProductCode:'P'+i,Quantity:1,UnitPrice:10000000,IsGift:false})),...(options.gift?[{id:'G',AppOrderId:'O1',ProductCode:'GIFT',Quantity:1,UnitPrice:0,IsGift:true}]:[])],products:brands.map((brand,i)=>product('P'+i,brand)),customers:[{CustomerCode:'C1',CustomerName:'Đại lý kiểm thử'}],start:'2026-10-22',end:'2026-11-02'});
const snapshot=makeSnapshot(['Toshiba','Hitachi']);
assert.equal(snapshot.lines[0].classification,'review'); // Gift behavior stays unchanged.
assert.equal(ctx.tourAmount(snapshot.lines[0]),155710000); // Header total, no prorating / double VAT.
assert.equal(ctx.sharpGross(snapshot.lines[0]),0);
const sharp=makeSnapshot(['Sharp','Sharp'],300000000,{gift:true}).lines[0];
assert.equal(ctx.tourAmount(sharp),300000000);assert.equal(ctx.sharpGross(sharp),300000000);
assert.equal(ctx.tourAmount(makeSnapshot(['Daikin','Daikin']).lines[0]),0);
assert.equal(ctx.tourAmount(makeSnapshot(['Daikin','Sharp']).lines[0]),0); // Cannot invent the mixed split.
assert.equal(ctx.tourAmount(makeSnapshot(['','Hitachi']).lines[0]),0);
const line={id:'a',customer:'A',date:'2026-10-27',product:'Nồi cơm',brand:'Sharp',amount:108000000,vat:true,cancelled:false,classification:'review'};
assert.equal(ctx.tourAmount(line),108000000);assert.equal(ctx.sharpGross(line),108000000);
for(const changes of [{cancelled:true},{vat:false},{amount:0}]){assert.equal(ctx.tourAmount({...line,...changes}),0);assert.equal(ctx.sharpGross({...line,...changes}),0);}
assert.equal(ctx.tourAmount({...line,brand:'Daikin',classification:'include'}),0);
assert.equal(ctx.tourAmount({...line,product:'SSUB',brand:'Panasonic'}),108000000);
assert.equal(ctx.tourAmount({...line,date:'2026-10-22'}),0);
assert.equal(ctx.sharpGross({...line,date:'2026-10-01'}),108000000);
assert.equal(ctx.sharpGross({...line,date:'2027-01-01'}),0);
assert.equal(ctx.tourAmount({...line,date:'2027-01-01'}),108000000);
// The 61,960,000 counted plus 155,710,000 held in a non-Daikin aggregate now count together.
assert.equal(ctx.tourAmount({...line,brand:'Toshiba',amount:61960000})+ctx.tourAmount(snapshot.lines[0]),217670000);
// Exercise the real customer aggregation used by the progress bars.
run(`let provinceSelection='all',scopeReady=true;const provinceMatches=()=>true;
const TOUR_CUSTOM=[],TOUR_DEFAULT={north:700000000,mangDen:1200000000},RULES={regular:[],svip:[]};`);
const helpers=promo.slice(promo.indexOf('function tourRules('),promo.indexOf('function endFor('));
run(helpers);
run(promo.slice(promo.indexOf('function customers()'),promo.indexOf('let warehouseDealerPage=0;')));
ctx.fixtureLines=[{...line,brand:'Toshiba',amount:61960000},snapshot.lines[0],{...sharp,id:'sharp'}].map(l=>({...l,customer:'Đại lý kiểm thử'}));
run("data.lines=fixtureLines;data.customers=['Đại lý kiểm thử','Đại lý chưa mua Sharp'];");
assert.equal(run('customers()[0].tourTotal'),517670000);
assert.equal(Math.round(run('customers()[0].sharpTotal*108/100')),300000000);
assert.equal(run('customers()[1].sharpTotal'),0);
assert.ok(!promo.includes('function sharpAllocations('));
assert.ok(promo.includes('tourDetail + sharpDetail'));
assert.equal(fs.readFileSync(__dirname+'/index-code.txt','utf8'),html);
// The changed embedded scripts must remain allowed by the CSP.
const crypto=require('node:crypto');const csp=html.match(/script-src ([^;]+);/)[1];let count=0;
function checkScripts(s){for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/type=["']application\/json/.test(m[1])){try{const x=JSON.parse(m[2]);if(typeof x==='string'&&x.includes('<script'))checkScripts(x);}catch{}}else if(!/\bsrc=/.test(m[1])&&m[2].trim()){new vm.Script(m[2]);assert.ok(csp.includes("'sha256-"+crypto.createHash('sha256').update(m[2]).digest('base64')+"'"));count++;}}}
checkScripts(html);checkScripts(app);checkScripts(zlib.gunzipSync(Buffer.from(payload('vt-map-document'),'base64')).toString());
console.log('Tour regression checks passed; '+count+' scripts parse and match CSP; missing-order fixture totals 217,670,000.');

