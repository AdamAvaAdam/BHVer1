const provinces=require('./source/provinces.cjs');
module.exports=function provinceTransform(s){
 const logic=String.raw`
const oldProvinceNames=PROVINCE_NAMES;
let provinceSelection='',scopeReady=false,provinceByName=new Map();
const provinceNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/^(tinh|thanh pho|tp\.?)[\s]+/,'').replace(/[^a-z0-9]/g,'');
function provinceCode(raw){const v=String(raw||'').trim();if(!v)return 'unknown';if(/^\d{1,2}$/.test(v)){const code=v.padStart(2,'0');return oldProvinceNames[code]?code:'other:'+v;}const aliases={HN:'01',HCM:'79',HP:'31',DN:'48',CT:'92'};if(aliases[v.toUpperCase()])return aliases[v.toUpperCase()];const found=Object.entries(oldProvinceNames).find(([c,n])=>provinceNorm(n)===provinceNorm(v));return found?.[0]||'other:'+v;}
function refreshProvinceIndex(){provinceByName=new Map();for(const l of data.lines){const k=customerKey(l.customer),code=provinceCode(l.warehouse?.provinceId);if(!provinceByName.has(k))provinceByName.set(k,new Set());provinceByName.get(k).add(code);}}
function customerProvince(name){const codes=provinceByName.get(customerKey(name));return codes?.size===1?[...codes][0]:'unknown';}
function provinceMatches(name){return !!provinceSelection&&(provinceSelection==='all'||customerProvince(name)===provinceSelection);}
function provinceLabel(code){return oldProvinceNames[code]||(code==='unknown'?'Chưa rõ tỉnh / cần đối chiếu':code.replace(/^other:/,'Mã tỉnh khác: '));}
function renderProvinceControl(){const select=$('#warehouse-province');const codes=new Set([...Object.keys(oldProvinceNames),...([...provinceByName.values()].flatMap(s=>[...s]))]);select.innerHTML='<option value="">Chọn khu vực để tải dữ liệu…</option><option value="all">Tất cả tỉnh cũ · tải toàn bộ</option>'+[...codes].filter(c=>c!=='unknown').sort((a,b)=>provinceLabel(a).localeCompare(provinceLabel(b),'vi')).map(c=>'<option value="'+esc(c)+'">'+esc(provinceLabel(c))+'</option>').join('')+'<option value="unknown">Chưa rõ tỉnh / cần đối chiếu</option>';select.value=provinceSelection;select.onchange=e=>{provinceSelection=e.target.value;scopeReady=false;warehouseDealerPage=0;linePage=0;render();if(provinceSelection)parent.VTLoadProvince?.(provinceSelection);};$('#warehouse-province-note').textContent=provinceSelection?'Tỉnh cũ · '+(provinceSelection==='all'?'Tất cả khu vực':provinceLabel(provinceSelection)):'Chọn tỉnh trước. Chưa tải đơn hàng.';}
`.replace('PROVINCE_NAMES',JSON.stringify(provinces));
 s=s.replace('const KEY =',logic+'\nconst KEY =');
 s=s.replace('<section class="tour-panel"><h2>Nguồn đơn hàng: Warehouse API</h2>','<section class="tour-panel"><h2>Nguồn đơn hàng: Warehouse API</h2><label>Lọc khách hàng theo tỉnh cũ <select id="warehouse-province"><option value="all">Tất cả tỉnh cũ</option></select></label><p id="warehouse-province-note" class="muted"></p>');
 s=s.replace('function render() {',`function render() {if(!provinceSelection||!scopeReady){$('#cards').innerHTML='';$('#program-live').innerHTML='<div class="scope-empty"><span>◎</span><h2>'+(!provinceSelection?'Chọn khu vực để bắt đầu':'Đang tải '+esc(provinceLabel(provinceSelection)))+'</h2><p>Chương trình và tiến độ đại lý sẽ hiện tại đây.</p></div>';$('#program-archive').innerHTML='<summary>Đã hoàn thành</summary><p>Chọn khu vực để xem kết quả.</p>';return;}`);
 s=s.replace('const all = customers();','const all = customers().filter(c=>provinceMatches(c.name));');
 s=s.replace('.filter(eligible)','.filter(l=>eligible(l)&&provinceMatches(l.customer))');
 s=s.replace('const current = data.lines.filter(line =>','const current = data.lines.filter(provinceLine=>provinceMatches(provinceLine.customer)).filter(line =>');
 s=s.replace('const list = data.lines\n    .filter(line =>','const list = data.lines.filter(provinceLine=>provinceMatches(provinceLine.customer))\n    .filter(line =>');
 s=s.replace('...customers().map(customer => [','...customers().filter(c=>provinceMatches(c.name)).map(customer => [');
 s=s.replace('render=function(){warehouseRenderOriginal();',"render=function(){if(provinceSelection&&scopeReady)refreshProvinceIndex();renderProvinceControl();warehouseRenderOriginal();if(!provinceSelection||!scopeReady){$('#warehouse-ledger-status').textContent=provinceSelection?'Đang tải khu vực đã chọn…':'Chưa tải đơn hàng';$('#warehouse-order-totals').innerHTML='';$('#warehouse-province-total').textContent='';$('#dealer-api-pages').innerHTML='';return;}");
 s=s.replace("for(const l of rows)totals.set", "for(const l of rows.filter(l=>provinceMatches(l.customer)))totals.set");
 s=s.replace("const q=norm($('#search').value);$('#warehouse-total-search')", "$('#warehouse-province-total').textContent='Tổng đơn của tỉnh đang chọn (gồm VAT): '+money([...totals.values()].reduce((a,b)=>a+b,0))+' · '+totals.size+' đại lý';\n const q=norm($('#search').value);$('#warehouse-total-search')");
 s=s.replace('<div id="warehouse-order-totals"','<p id="warehouse-province-total"></p><div id="warehouse-order-totals"');
 s=s.replace('<th>Tổng đơn bán gồm VAT</th>','<th>Tỉnh cũ</th><th>Tổng đơn bán gồm VAT</th>');
 s=s.replace("esc(name)+'</td><td>'+money(total)","esc(name)+'</td><td>'+esc(provinceLabel(customerProvince(name)))+'</td><td>'+money(total)");
 return s;
};
