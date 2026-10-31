const fs=require('node:fs'),path=require('node:path');
const load=String.raw`async function load(){
 if(loading)return;loading=true;window.vtStockFresh=false;$('reload').disabled=true;$('copySelected').disabled=true;$('status').textContent='Đang đọc tồn Warehouse và bảng giá trang tính cũ…';
 try{
  const r=await window.VTSecureRequest('/api/warehouse/catalog');const d=await r.json();if(!r.ok)throw Error(d.error||'Chưa đọc được Warehouse');
  if(!Array.isArray(d.items)||!d.items.length)throw Error('Danh mục Warehouse chưa có sản phẩm.');
  const offlineSpecs=new Map((typeof SPEC_SNAPSHOT==='undefined'?[]:SPEC_SNAPSHOT.slice(1)).map(row=>[key(row[0]),row]));
  const before=items;items=d.items.map(i=>{const saved=offlineSpecs.get(key(i.sku))||offlineSpecs.get(key(i.model));return {...i,spec:custom[i.key]||custom[key(i.sku)]||custom[key(i.model)]||[i.sheetSpec||'',saved?.[2]||''].filter(Boolean).join('\n'),specSource:saved?.[3]||i.specSource,specStatus:saved?'Thông số tham khảo lưu sẵn · '+(saved[4]||''):i.specStatus,programs:i.programs||[]};});if(before.some(i=>!i.apiPriceMissing)&&items.some(i=>!i.apiPriceMissing))comparePrices(items.filter(i=>!i.apiPriceMissing),before.filter(i=>!i.apiPriceMissing));selected.clear();opened.clear();sourceDescription='Giá: trang tính cũ · Tồn: Warehouse API';lastSync=new Date(d.time).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});loadNote=d.notice+' '+d.stock.conflicts+' mã tồn trùng cùng mốc cần đối soát.';window.vtStockFresh=true;window.vtStockTime=Date.parse(d.time);filter();
 }catch(e){$('status').textContent=e.message+' · Không lấy lại từ Sheets.';$('status').classList.add('error');if(!items.length)$('list').replaceChildren(el('div','empty',e.message));}
 finally{loading=false;$('reload').disabled=false;$('copySelected').disabled=!items.some(i=>!i.apiPriceMissing);$('selectAll').disabled=!items.some(i=>!i.apiPriceMissing);if(parent!==window&&parent.vtCatalogChanged)parent.vtCatalogChanged();}
}`;
function sales(s){
 const start=s.indexOf('async function load(){'),end=s.indexOf('\nfunction filter()',start);if(start<0||end<0)throw Error('Catalog load anchors changed');s=s.slice(0,start)+load+s.slice(end);
 s=s.replace("const money=n=>n.toLocaleString('vi-VN')+'đ';","const money=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('vi-VN')+'đ':'Chưa có giá trong bảng';");
 s=s.replace(/async function readSheet\(gid\)\{[\s\S]*?(?=\nlet state=)/,String.raw`async function readSheet(gid){
  if(gid==='912353833'&&parent.vtReadOrders)return parent.vtReadOrders(parent.vtRecommendationProvince);
  if(gid!=='1701246983')throw Error('Nguồn không hỗ trợ.');
  const response=await window.VTSecureRequest('/api/warehouse/customers'),d=await response.json();if(!response.ok)throw Error(d.error||'Chưa đọc được khách API');
  return {cols:[{id:'B',label:'Tên'},{id:'C',label:'Mã khách'},{id:'D',label:''},{id:'E',label:''},{id:'F',label:'Tỉnh'}],rows:d.data.map(c=>({c:[c.CustomerName,c.CustomerCode,'','',c.ProvinceId||''].map(v=>({v}))})),source:'Warehouse API'};
}`);
 s=s.replace("$('autoSource').addEventListener('click',configureAutoSource)","$('autoSource').textContent='Giá Sheets · Tồn API';$('autoSource').addEventListener('click',()=>toast('Bảng giá từ tab mới nhất của trang tính cũ; tồn và đơn từ Warehouse.'))");
 s=s.replace("return toast('Chọn ít nhất một mức giá')","return toast('Chưa có giá bán API hợp lệ để báo giá')");
 s=s.replace("'📋 Copy giá',()=>copyText(singleText(i,i.default))", "'📋 Copy giá',()=>i.apiPriceMissing?toast('Mã này chưa khớp giá cuối F trong trang tính.'):copyText(singleText(i,i.default))");
 s=s.replace("function toggle(i){", "function toggle(i){if(i.apiPriceMissing)return toast('Mã này chưa có giá trong bảng tính.');");
 s=s.replace('for(const i of visible)if(all)', 'for(const i of visible.filter(i=>!i.apiPriceMissing))if(all)');
 s=s.replace('for(const i of items)for(const p of i.programs)if(selected.has(p.id))', 'for(const i of items.filter(i=>!i.apiPriceMissing))for(const p of i.programs)if(Number.isFinite(p.price)&&selected.has(p.id))');
 s=s.replace("quote.append(el('div','price',money(i.default.price))", "if(i.default.basePrice)info.append(el('div','program','Giá gốc (D): '+money(i.default.basePrice)+(i.default.promotion?' · KM (E): '+i.default.promotion:'')+' · Giá bán dùng cột F'));quote.append(el('div','price',money(i.default.price))");
 s=s.replace('mainCheck.indeterminate=', 'mainCheck.disabled=!!i.apiPriceMissing;mainCheck.indeterminate=');
 s=s.replace("info.append(tools);row.append(info);", "info.append(tools);row.append(info);");
 s=s.replaceAll('Đang chờ bảng giá để lấy danh sách chương trình…','Chọn chương trình từ bảng giá trang tính; tồn và lịch sử đơn lấy từ Warehouse.');
 s=s.replaceAll('Giá đại diện ưu tiên CT có chữ “lẻ”, nếu không có lấy giá cao nhất.','Danh mục và tồn lấy trực tiếp API.');
 s=s.replace("state.ordersFresh=true;state.lastSync=new Date();state.ordersStatus=new Set(parsed.lines.map(l=>l.id)).size+' đơn · 30 ngày gần nhất dùng chấm điểm';", "state.ordersFresh=true;state.lastSync=new Date();state.ordersStatus=new Set(parsed.lines.map(l=>l.id)).size+' đơn từ Warehouse API · '+(results[0].value.issues||0)+' đơn chờ xác minh sản phẩm';");
 s=s.replace("async function loadBoard(){","async function loadBoard(){if(!parent.vtSelectedProvince){state.ordersStatus='Chọn khu vực ở tab Doanh số & chương trình để tải lịch sử.';renderBoard();return;}");
 s=s.replaceAll('Chưa tải được đơn; dữ liệu giữ lại có thể cũ','Chưa tải được đơn API; không dùng dữ liệu Sheets');
 return require('./recommendation-transform.cjs')(s);
}
function promo(s){
 s=s.replace('function render() {','let warehouseDealerPage=0;\nfunction render() {');
 s=s.replace('<div id="cards" class="cards"></div>','<div id="dealer-api-pages" class="toolbar"></div><div id="cards" class="cards"></div>');
 s=s.replace('  $("#cards").innerHTML = list.length',String.raw`  warehouseDealerPage=Math.max(0,Math.min(warehouseDealerPage,Math.max(0,Math.ceil(list.length/50)-1)));
  const dealerVisible=list.slice(warehouseDealerPage*50,(warehouseDealerPage+1)*50);
  $('#dealer-api-pages').innerHTML='<span>'+list.length+' đại lý · Trang '+(warehouseDealerPage+1)+'/'+Math.max(1,Math.ceil(list.length/50))+' · 50 đại lý/trang</span> <button id="dealer-prev" '+(!warehouseDealerPage?'disabled':'')+'>Trước</button> <button id="dealer-next" '+((warehouseDealerPage+1)*50>=list.length?'disabled':'')+'>Sau</button>';
  $('#dealer-prev').onclick=()=>{warehouseDealerPage--;render();};$('#dealer-next').onclick=()=>{warehouseDealerPage++;render();};
  $("#cards").innerHTML = list.length`);
 s=s.replace('? list.map((customer, index) => {','? dealerVisible.map((customer, index) => {');
 s=s.replace("(index + 1) + '</span><span class=\"dealer-heading\">'", "(warehouseDealerPage*50 + index + 1) + '</span><span class=\"dealer-heading\">'");
 s=s.replace("(index + 1) + '</span><span", "(warehouseDealerPage*50 + index + 1) + '</span><span");
 s=s.replace('addEventListener("input", render)','addEventListener("input",()=>{warehouseDealerPage=0;render();})');
 s=s.replaceAll('Mở rộng tất cả','Mở rộng trang này').replaceAll('Rút gọn tất cả','Rút gọn trang này');
 s=s.replace("rows.map(r=>'<tr><td>'", "rows.filter(r=>norm(r.name).includes(norm($('#search').value))).slice(0,50).map(r=>'<tr><td>'");
 s=s.replace('async function readGoogle() {','async function readGoogle() {throw Error("Đã ngắt Google Sheets. Dùng Cập nhật đơn Warehouse.");');
 s=s.replace('function customers() {',`function customers() {`);
 const marker='<section id="program-live"';s=s.replace(marker,'<section class="tour-panel"><h2>Nguồn đơn hàng: Warehouse API</h2><p id="warehouse-ledger-status">Chưa cập nhật đơn Warehouse.</p><button id="open-api-orders">Cập nhật đơn & tính chương trình</button><label>Tìm đại lý <input id="warehouse-total-search" placeholder="Nhập tên đại lý để đối chiếu tổng đơn"></label><p class="muted">Hiện tối đa 50 đại lý khớp tên. Tổng số và báo cáo vẫn gồm toàn bộ đại lý.</p><div id="warehouse-order-totals" class="tablewrap"></div></section>'+marker);
 s=s.replace('const inDates=l=>', 'const inDates=l=>');
 s=s.replace("classification:approval.statuses.includes(l.warehouse?.status)?'auto':'review'", "classification:l.warehouse?.reviewReason?'review':approval.statuses.includes(l.warehouse?.status)?'auto':'review'");
 s=s.replace('orders:snapshot.orders,lines:incoming.length,issues:snapshot.issues','orders:snapshot.orders,lines:incoming.length,totalAmount:snapshot.totalAmount,issues:snapshot.issues,policy:snapshot.policy');
 const script=String.raw`<script>
const warehouseRenderOriginal=render;
render=function(){warehouseRenderOriginal();
 const w=data.warehouseState,rows=data.lines.filter(l=>l.sourceId==='warehouse:huonganh:v1'),totals=new Map();for(const l of rows)totals.set(l.customer,(totals.get(l.customer)||0)+l.amount);
 $('#warehouse-ledger-status').textContent=w?(w.orders+' đơn trong lần cập nhật · Tổng tiền đã gồm VAT '+money(w.totalAmount??[...totals.values()].reduce((a,b)=>a+b,0))+' · '+w.issues.length+' đơn chờ phân loại sản phẩm · '+new Date(w.time).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})):'Chưa cập nhật. Bấm nút bên dưới để lấy đơn trực tiếp API.';
 const q=norm($('#search').value);$('#warehouse-total-search').value=$('#search').value;$('#warehouse-total-search').oninput=e=>{$('#search').value=e.target.value;warehouseDealerPage=0;render();};
 $('#warehouse-order-totals').innerHTML=totals.size?'<table><thead><tr><th>Đại lý</th><th>Tổng đơn bán gồm VAT</th></tr></thead><tbody>'+[...totals].filter(([name])=>norm(name).includes(q)).sort((a,b)=>b[1]-a[1]).slice(0,50).map(([name,total])=>'<tr><td>'+esc(name)+'</td><td>'+money(total)+'</td></tr>').join('')+'</tbody></table>':'';
 $('#open-api-orders').onclick=()=>parent.VTUpdateOrders?.();
 $('#sync-google').hidden=true;$('#open-google').hidden=true;const state=$('#source-status');if(!w)state.textContent='Nguồn đơn: Warehouse API. Đang chờ cập nhật lần đầu; không đọc Google Sheets.';
};
window.VTPromotions.snapshot=()=>({updated:data.warehouseState?.time||null,lines:data.lines.length,review:data.lines.filter(l=>!l.cancelled&&decision(l)==='review').length});
render();
</script>`;
 return require('./dashboard-transform.cjs').promo(require('./province-transform.cjs')(s.replace('</body>',script+'</body>')));
}
function outer(html){
 const start=html.indexOf('window.vtReadOrders=async function(){'),end=html.indexOf('\nconst style=element',start);if(start<0||end<0)throw Error('History source anchors changed');
 html=html.slice(0,start)+String.raw`window.vtReadOrders=async function(province=window.vtRecommendationProvince){if(!province)throw Error('Chọn khu vực trước khi tải lịch sử.');window.vtHistoryCache??=new Map();window.vtHistoryPending??=new Map();const cached=window.vtHistoryCache.get(province);if(cached&&Date.now()-cached.time<60000)return clone(cached.data);if(window.vtHistoryPending.has(province))return clone(await window.vtHistoryPending.get(province));const pending=(async()=>{const r=await window.VTSecureRequest('/api/warehouse/history?province='+encodeURIComponent(province)),d=await r.json();if(!r.ok)throw Error(d.error||'Chưa đọc được lịch sử API');window.vtHistoryCache.set(province,{time:Date.now(),data:d});return d;})();window.vtHistoryPending.set(province,pending);try{return clone(await pending);}finally{window.vtHistoryPending.delete(province);}};`+html.slice(end);
 html=html.replace('Chưa có lần đồng bộ Sheets được ghi nhận. Mở Doanh số & chương trình → Google Sheets để xác nhận VAT và cập nhật.','Chưa cập nhật đơn Warehouse. Bấm Cập nhật đơn & tính chương trình.');
 html=html.replace('Giá báo bán hiện tại vẫn dùng nguồn cũ vì tài liệu API chưa có trường giá bán tương ứng.','Giá bán từ trang tính cũ, dùng cột F. Tồn, khách hàng và đơn hàng lấy từ Warehouse API.');
 const add=String.raw`<script>
(function(){
 const by=id=>document.getElementById(id),engine=()=>by('promo-frame')?.contentWindow?.VTPromotions,client=window.VTWarehouse;
 window.VTOpenWarehouseOrders=()=>by('warehouse-dialog').showModal();by('open-warehouse').textContent='Cập nhật đơn & tính chương trình';
 const approvals=by('wh-approvals');approvals.hidden=true;by('wh-commit').hidden=true;by('wh-stock').hidden=true;
 const policy=document.createElement('p');policy.textContent='Quy tắc công ty: cộng toàn bộ đơn đặt hàng bán; TotalAmount đã gồm VAT. Đơn chưa rõ sản phẩm vẫn có trong tổng đơn, chờ phân loại chương trình.';approvals.before(policy);
 let reading=false,requestGeneration=0;window.vtSelectedProvince='';window.vtProvinceLabel=code=>by('promo-frame')?.contentWindow?.VTPromotions?.provinceLabel?.(code)||code;
 window.VTLoadProvince=async function(province){window.vtSelectedProvince=province;rawOrders=null;ordersTime=0;await update(province);};
 async function update(province=window.vtSelectedProvince){if(!province){by('wh-status').textContent='Chọn khu vực ở tab Doanh số & chương trình trước.';return;}const generation=++requestGeneration;reading=true;by('wh-read').disabled=true;by('wh-status').textContent='Đang đọc đơn Warehouse và tính doanh số…';try{
  const r=await window.VTSecureRequest('/api/warehouse/snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:by('wh-start').value,end:by('wh-end').value,staff:by('wh-staff').value.trim(),province})}),d=await r.json();if(!r.ok)throw Error(d.error||'Chưa đọc được đơn API');if(!engine())throw Error('Chờ bộ tính chương trình mở xong.');
  if(generation!==requestGeneration||province!==window.vtSelectedProvince)return;engine().setScope(province,true);engine().importWarehouse(d,{vat:true,statuses:d.statuses});const box=by('wh-preview');box.replaceChildren();const message=document.createElement('p');message.textContent=d.orders+' đơn · Tổng đơn đã gồm VAT '+new Intl.NumberFormat('vi-VN').format(d.totalAmount)+'đ · '+d.issues.length+' đơn chờ xác minh sản phẩm.';box.append(message);const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Đơn chờ phân loại chương trình ('+d.issues.length+')';detail.append(summary);for(const issue of d.issues.slice(0,100)){const p=document.createElement('p');p.textContent=issue.order+' · '+issue.reason;detail.append(p);}box.append(detail);
  by('wh-status').textContent='Đã cập nhật đơn và tính lại chương trình từ Warehouse. Phần chờ phân loại chưa cộng nhầm vào Sharp/Hương Anh.';by('wh-approvals').hidden=true;window.vtPromotionChanged?.();
 }catch(e){by('wh-status').textContent=e.message+' Dữ liệu trước đó được giữ.';if(generation===requestGeneration)engine()?.scopeError?.(e.message);}finally{reading=false;by('wh-read').disabled=false;}}
 by('wh-read').onclick=()=>update();window.VTUpdateOrders=()=>update();
 // Orders are loaded only after an explicit region selection.
 setInterval(()=>{if(!document.hidden&&engine()&&window.vtSelectedProvince&&!reading)update();},300000);
})();
</script>`;
 return require('./map-transform.cjs')(require('./dashboard-transform.cjs').outer(html.replace('</body>',add+'</body>')));
}
module.exports={sales,promo,outer};
