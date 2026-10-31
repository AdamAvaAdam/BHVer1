import '../source/client.js';
import {provinceCode} from './province.mjs';
const domain=globalThis.VTWarehouse;
const numeric=v=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const sku=v=>String(v||'').trim().toUpperCase();
export function normalizeOrders({orders,details,products,customers,start,end,staff=''}){
 const ps=new Map(products.map(p=>[String(p.ProductSku),p])),cs=new Map(customers.map(c=>[String(c.CustomerCode),c])),byOrder=new Map();
 for(const l of details){if(!byOrder.has(l.AppOrderId))byOrder.set(l.AppOrderId,[]);byOrder.get(l.AppOrderId).push(l);}
 const lines=[],issues=[],statuses=new Set();let totalAmount=0,invalidOrders=0;
 for(const o of orders){
  const amount=numeric(o.TotalAmount),status=String(o.temp?.DocStatus??'Không có'),date=domain.day(o.DocDate),name=cs.get(String(o.CustomerCode))?.CustomerName||'Chưa khớp tên · '+String(o.CustomerCode||o.AppOrderId),raw=byOrder.get(o.AppOrderId)||[],paid=raw.filter(l=>l.IsGift!==true&&numeric(l.Quantity)>0),codes=[...new Set(paid.map(l=>String(l.ProductCode||'')))];statuses.add(status);
  if(!Number.isSafeInteger(amount)){invalidOrders++;issues.push({order:String(o.OrderRefNo||o.AppOrderId),date,reason:'Tổng tiền đơn không hợp lệ',total:amount});continue;}
  totalAmount+=amount;const declared=numeric(o.temp?.TotalLine),missing=declared!==null&&declared>paid.length;
  const make=(id,value,p,quantity,reason='')=>({id:domain.SOURCE+':order:'+o.AppOrderId+':'+id,sourceId:domain.SOURCE,source:'Warehouse: '+(o.OrderRefNo||o.AppOrderId),customer:name,date,amount:value,product:p?p.ProductName:'Chưa xác minh sản phẩm · '+(o.OrderRefNo||o.AppOrderId),brand:p?.BrandCode||'',vat:true,classification:reason?'review':'auto',cancelled:false,warehouse:{orderId:o.AppOrderId,customerCode:o.CustomerCode,provinceId:String(cs.get(String(o.CustomerCode))?.ProvinceId||''),productCode:p?.ProductSku||'',status,staff:o.SalesStaffCode||'',quantity,reviewReason:reason,headerTotal:amount}});
  let reason='';
  if(amount<=0)reason='Đơn tiền không dương: có trong tổng đơn, cần quy tắc điều chỉnh cho chương trình';
  else if(!paid.length)reason='Thiếu dòng sản phẩm bán';
  else if(codes.some(code=>!ps.has(code)))reason='Chưa khớp mã sản phẩm';
  else if(missing)reason='Thiếu chi tiết so với số dòng đầu đơn';
  if(!reason&&codes.length===1){const p=ps.get(codes[0]);lines.push(make(codes[0],amount,p,paid.reduce((n,l)=>n+numeric(l.Quantity),0)));continue;}
  const calculated=paid.reduce((n,l)=>n+(numeric(l.Quantity)||0)*(numeric(l.UnitPrice)||0),0);
  if(!reason&&Number(o.TotalDiscount||0)===0&&calculated===amount&&paid.every(l=>Number.isSafeInteger(Number(l.Quantity)*Number(l.UnitPrice))&&Number(l.Quantity)*Number(l.UnitPrice)>0)){
   for(const l of paid)lines.push(make(String(l.id),Number(l.Quantity)*Number(l.UnitPrice),ps.get(String(l.ProductCode)),Number(l.Quantity)));continue;
  }
  if(!reason)reason='Đơn nhiều sản phẩm chưa có tiền sau chiết khấu từng dòng';
  lines.push(make('review',amount,null,null,reason));issues.push({order:String(o.OrderRefNo||o.AppOrderId),date,reason,total:amount});
 }
 return {source:domain.SOURCE,start,end,staff,lines,issues,statuses:[...statuses].sort(),orders:orders.length,time:new Date().toISOString(),totalAmount,invalidOrders,policy:{allOrderStatuses:true,amountIncludesVAT:true,amountField:'TotalAmount'}};
}
export function buildCatalog(products,stocks,promotions=[],details=[],today=domain.day(new Date().toISOString())){
 const known=new Set(products.map(p=>sku(p.ProductSku))),groups=new Map();let unmatched=0,aliasMatches=0,conflicts=0;
 for(const row of stocks){const key=sku(row.ProductSku||row.ItemCode);if(!known.has(key)){unmatched++;continue;}if(!row.ProductSku)aliasMatches++;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const selected=new Map();
 for(const [key,rows] of groups){
  const dated=rows.map(r=>({row:r,time:Date.parse(r.updateLatestAt||r.insertLatestAt||'')}));
  const latest=Math.max(...dated.map(x=>Number.isFinite(x.time)?x.time:-Infinity));
  const candidates=dated.filter(x=>(Number.isFinite(x.time)?x.time:-Infinity)===latest);
  if(candidates.length!==1){conflicts++;selected.set(key,null);continue;}
  selected.set(key,numeric(candidates[0].row.CloseInventory));
 }
 const current=promotions.filter(p=>Number(p.IsActive)===1&&(!p.FromDate||domain.day(p.FromDate)<=today)&&(!p.ToDate||domain.day(p.ToDate)>=today));
 const promoMap=new Map(current.map(p=>[String(p.PromoId),p])),bySku=new Map();
 for(const d of details){const p=promoMap.get(String(d.PromoId));if(!p)continue;const key=sku(d.ProductCode);if(!bySku.has(key))bySku.set(key,[]);bySku.get(key).push({code:p.PromoCode,name:p.PromoName||p.PromoCode,from:p.FromDate,to:p.ToDate,condition:d.ApplyCondition||d.Note||'',discountType:p.DiscountType,discountRate:d.DiscountRate,discountValue:d.DiscountValue,minQty:d.MinQty,maxQty:d.MaxQty,gift:d.GiftProductCode||null});}
 const items=products.filter(p=>p.ProductSku&&p.ProductName).map(p=>{
  const code=sku(p.ProductSku),offer={id:'warehouse:unpriced:'+p.ProductSku,price:null,km:'API chưa có giá bán hiện hành. Cần xác nhận giá trước khi báo.',date:'',newToday:false};
  const offers=(bySku.get(code)||[]).map((pm,i)=>({id:'warehouse:promotion:'+code+':'+pm.code+':'+i,price:null,km:pm.name+(pm.condition?' · '+pm.condition:''),date:pm.from?domain.day(pm.from):'',newToday:false}));
  const specs=[p.BaseUnit?'Đơn vị: '+p.BaseUnit:'',numeric(p.WarrantyMonth)>0?'Bảo hành: '+p.WarrantyMonth+' tháng':''].filter(Boolean).join(' · ');
  return {key:'warehouse:'+code,model:p.ModelCode||p.ProductSku,sku:p.ProductSku,name:p.ProductName,brand:p.BrandCode||'',stock:selected.has(code)?selected.get(code):null,programs:offers,default:offers[0]||offer,min:null,sheetSpec:specs,spec:specs,specSource:'Warehouse API',specStatus:'Thông số có trong danh mục API',apiPriceMissing:true,apiPromotions:bySku.get(code)||[]};
 });
 return {source:'Warehouse API',time:new Date().toISOString(),items,priceAvailable:false,activePromotions:current.length,promotionDetails:details.length,stock:{rows:stocks.length,matchedProducts:groups.size,unmatched,aliasMatches,conflicts},notice:'API đang có tồn kho và chiết khấu khuyến mãi, chưa có bảng giá bán cơ sở. Không lấy giá đơn lịch sử làm giá bán hiện tại.'};
}
export function historyTable(snapshot){
 const ids=['A','B','C','F','H','P','Q'],labels=['Số','Ngày','Đối tượng','Nội dung','Số lượng','Tổng tiền','Hãng'];
 return {cols:ids.map((id,i)=>({id,label:labels[i]})),rows:snapshot.lines.slice(0,20000).map(l=>({c:[l.source.replace(/^Warehouse: /,''),l.date,l.customer,l.product,l.warehouse?.quantity??null,l.amount,l.brand].map(v=>({v}))})),source:'Warehouse API',time:snapshot.time,issues:snapshot.issues.length,requiresReview:true,truncated:snapshot.lines.length>20000};
}
export function createWarehouseData(page){
 const cache=new Map();
 async function list(resource,filters={}){
  let total=null;const result=[],seen=new Set();
  for(let n=1;n<=500;n++){
   const d=await page(resource,{...filters,_page:String(n),_limit:'200',_orderBy:'id:asc'});
   if(!Array.isArray(d.data)||!Number.isInteger(d._totalData)||d._totalData>100000||d._page!==n||typeof d._hasNextPage!=='boolean')throw Error('Phân trang API không hợp lệ.');
   if(total!==null&&total!==d._totalData)throw Error('Nguồn đang thay đổi khi đọc, cần cập nhật lại.');total=d._totalData;
   for(const row of d.data){if(row.id==null||seen.has(String(row.id)))throw Error('Dòng API thiếu mã hoặc trùng trang.');seen.add(String(row.id));result.push(row);}
   if(!d._hasNextPage){if(result.length!==total)throw Error('Chưa đọc đủ nguồn API.');return result;}
   if(!d.data.length)throw Error('Trang API rỗng bất thường.');
  }
  throw Error('Nguồn quá giới hạn.');
 }
 async function cached(key,loader,ttl=120000){const old=cache.get(key);if(old?.value&&Date.now()<old.until)return old.value;if(old?.pending)return old.pending;const entry={pending:null};entry.pending=loader().then(value=>{cache.set(key,{value,until:Date.now()+ttl});return value;},error=>{cache.delete(key);throw error;});cache.set(key,entry);return entry.pending;}
 const products=()=>cached('products',()=>list('wh_products'));
 const customers=()=>cached('customers',()=>list('wh_customers'));
 async function revenue(start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('Khoảng doanh số không hợp lệ.');
  const chunks=[];let cursor=start;while(cursor<=end){const next=new Date(Date.UTC(Number(cursor.slice(0,4)),Number(cursor.slice(5,7)),1)).toISOString().slice(0,10),last=new Date(Date.parse(next+'T00:00:00Z')-86400000).toISOString().slice(0,10);chunks.push([cursor,last<end?last:end]);cursor=next;if(chunks.length>12)throw Error('Chỉ tải tối đa một năm.');}
  const aggregate=new Map();let orderCount=0,totalAmount=0;const times=[];
  for(const [from,to] of chunks){const value=await cached('revenue:'+from+':'+to,async()=>{
   const lower=new Date(Date.parse(from+'T00:00:00+07:00')-1).toISOString(),upper=new Date(Date.parse(to+'T00:00:00+07:00')+86400000).toISOString();
   const rows=await list('wh_sales_orders',{'DocDate>':lower,'DocDate<':upper,_fields:'id,AppOrderId,CustomerCode,DocDate,TotalAmount'}),seen=new Set(),byCustomer=new Map();let count=0,total=0;
   for(const o of rows){const date=domain.day(o.DocDate);if(date<from||date>to)continue;const amount=numeric(o.TotalAmount),code=String(o.CustomerCode||'').trim().toUpperCase(),id=String(o.AppOrderId||'');if(!id||seen.has(id)||!Number.isSafeInteger(amount))throw Error('Đầu đơn doanh số thiếu tiền hợp lệ hoặc trùng mã.');seen.add(id);const old=byCustomer.get(code)||{amount:0,orders:0};old.amount+=amount;old.orders++;if(!Number.isSafeInteger(old.amount))throw Error('Tổng doanh số vượt giới hạn.');byCustomer.set(code,old);count++;total+=amount;}
   if(!Number.isSafeInteger(total))throw Error('Tổng doanh số không hợp lệ.');return {byCustomer:[...byCustomer],orders:count,totalAmount:total,time:new Date().toISOString()};
  },120000);for(const [code,row] of value.byCustomer){const old=aggregate.get(code)||{amount:0,orders:0};old.amount+=row.amount;old.orders+=row.orders;aggregate.set(code,old);}orderCount+=value.orders;totalAmount+=value.totalAmount;times.push(value.time);}
  if(!Number.isSafeInteger(totalAmount))throw Error('Tổng doanh số không hợp lệ.');return {start,end,byCustomer:[...aggregate],orders:orderCount,totalAmount,time:times.sort()[0]||new Date().toISOString(),source:'Warehouse API',amountField:'TotalAmount',amountIncludesVAT:true,allStatuses:true};
 }
 async function snapshot(start,end,staff='',province='all'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end||staff.length>80||staff.includes(','))throw Error('Phạm vi đơn hàng không hợp lệ.');
  if(typeof province!=='string'||!province||province.length>80)throw Error('Chọn khu vực trước khi đọc đơn.');
  return cached('orders:'+start+':'+end+':'+staff+':'+province,async()=>{
   const [ps,cs]=await Promise.all([products(),customers()]);const filters={'DocDate>':start+'T00:00:00+07:00','DocDate<':end+'T23:59:59.999+07:00',...(staff?{SalesStaffCode:staff}:{})};let raw=[];
   const selected=province==='all'?cs:cs.filter(c=>provinceCode(c.ProvinceId)===province),customerCodes=selected.map(c=>String(c.CustomerCode));
   if(province==='all')raw=await list('wh_sales_orders',filters);
   else for(let i=0;i<customerCodes.length;i+=100){const codes=customerCodes.slice(i,i+100);if(codes.some(c=>!c||c.includes(',')))throw Error('Mã khách khu vực chưa hợp lệ.');const batch=await list('wh_sales_orders',{...filters,CustomerCode:codes.join(',')});if(batch.some(o=>!codes.includes(String(o.CustomerCode))))throw Error('Warehouse chưa lọc đúng khu vực.');raw.push(...batch);}
   const orders=raw.filter(o=>domain.day(o.DocDate)>=start&&domain.day(o.DocDate)<=end&&(!staff||o.SalesStaffCode===staff)),ids=orders.map(o=>o.AppOrderId);
   if(new Set(ids).size!==ids.length||ids.some(id=>!id||String(id).includes(',')))throw Error('Mã đơn nguồn chưa hợp lệ.');
   const details=[];
   for(let i=0;i<ids.length;i+=300){const batches=[];for(let j=i;j<Math.min(ids.length,i+300);j+=100)batches.push(list('wh_sales_order_details',{AppOrderId:ids.slice(j,Math.min(j+100,ids.length)).join(',')}));for(const rows of await Promise.all(batches))details.push(...rows);}
   const allowed=new Set(ids);if(details.some(l=>!allowed.has(l.AppOrderId)))throw Error('Bộ lọc chi tiết đơn chưa khớp.');
   return {...normalizeOrders({orders,details,products:ps,customers:cs,start,end,staff}),province,customerCodes};
  },60000);
 }
 async function catalog(){return cached('catalog',async()=>{const [ps,ss,pm,pd]=await Promise.all([products(),list('wh_stock_reports'),list('wh_promotions'),list('wh_promotion_details')]);return buildCatalog(ps,ss,pm,pd);});}
 return {catalog,snapshot,customers,list,revenue};
}
