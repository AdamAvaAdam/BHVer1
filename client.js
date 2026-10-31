(function(root){
 'use strict';
 const BASE='https://warehouseapi.huonganhgroup.vn/v1';
 const SOURCE='warehouse:huonganh:v1';
 const allowed=new Set(['wh_sales_orders','wh_sales_order_details','wh_customers','wh_products','wh_stock_reports']);
 const number=v=>{if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))throw Error('Nguồn có số tiền/số lượng không hợp lệ.');return Number(v);};
 function day(v){const text=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;if(!Number.isFinite(Date.parse(text)))throw Error('Ngày chứng từ không hợp lệ.');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(text));return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');}
 class Client {
  constructor(fetcher=root.fetch.bind(root)){this.fetcher=fetcher;this.access=null;this.refresh=null;}
  async request(path,options={},retried=false){
   const r=await this.fetcher(BASE+path,{...options,headers:{Accept:'application/json',...(this.access?{Authorization:'Bearer '+this.access}:{}),...options.headers},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
   if(r.status===401&&this.refresh&&!retried){
    const refreshed=await this.fetcher(BASE+'/auth/refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:this.refresh}),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
    if(refreshed.ok){const session=await refreshed.json();if(typeof session.accessToken?.token==='string'){this.access=session.accessToken.token;this.refresh=session.refreshToken?.token||null;return this.request(path,options,true);}}
    this.disconnect();
   }
   if(r.status===401||r.status===403)throw Error('API yêu cầu xác thực hoặc chưa cấp quyền đọc. Nhập khóa API gốc để kết nối; dữ liệu cũ được giữ.');
   if(!r.ok)throw Error('Warehouse trả lỗi '+r.status+'. Chưa thay dữ liệu ứng dụng.');
   return r.json();
  }
  async login(secretKey){if(!secretKey.trim())throw Error('Nhập khóa API gốc, không phải mật khẩu tài khoản.');const d=await this.request('/auth/api_key_login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secretKey:secretKey.trim()})});if(typeof d.accessToken?.token!=='string')throw Error('API chưa trả accessToken.token hợp lệ.');this.access=d.accessToken.token;this.refresh=d.refreshToken?.token||null;}
  disconnect(){this.access=null;this.refresh=null;}
  async list(resource,filters={},progress=()=>{}){
   if(!allowed.has(resource))throw Error('Nguồn đọc chưa được hỗ trợ.');
   const result=[],ids=new Set();let expected=null;
   for(let page=1;page<=500;page++){
    const params=new URLSearchParams({...filters,_page:String(page),_limit:'200',_orderBy:'id:asc'});
    const d=await this.request('/'+resource+'/paginate?'+params);
    if(!Array.isArray(d.data)||!Number.isInteger(d._totalData)||d._totalData<0||d._totalData>100000||d._page!==page||typeof d._hasNextPage!=='boolean')throw Error('Phân trang Warehouse không hợp lệ; giữ dữ liệu cũ.');
    if(expected!==null&&expected!==d._totalData)throw Error('Nguồn đang thay đổi trong lúc đọc. Hãy cập nhật lại.');expected=d._totalData;
    for(const row of d.data){if(row.id==null||ids.has(String(row.id)))throw Error('Nguồn thiếu mã dòng hoặc lặp trang.');ids.add(String(row.id));result.push(row);}
    progress(resource,result.length,expected);
    if(!d._hasNextPage){if(result.length!==expected)throw Error('Chưa đọc đủ dữ liệu Warehouse.');return result;}
    if(!d.data.length)throw Error('Trang rỗng bất thường.');
   }
   throw Error('Nguồn vượt giới hạn đọc.');
  }
  async snapshot({start,end,staff='',progress=()=>{}}){
   // Actual server accepts these documented comparison keys. Recheck dates locally.
   const filters={'DocDate>':start+'T00:00:00+07:00','DocDate<':end+'T23:59:59.999+07:00'};if(staff.trim())filters.SalesStaffCode=staff.trim();
   const orders=(await this.list('wh_sales_orders',filters,progress)).filter(o=>day(o.DocDate)>=start&&day(o.DocDate)<=end&&(!staff.trim()||o.SalesStaffCode===staff.trim()));
   if(!orders.length)throw Error('Không có đơn trong phạm vi đã chọn. Chưa thay nguồn cũ.');
   const customers=await this.list('wh_customers',{_fields:'id,CustomerCode,CustomerName'},progress);
   const products=await this.list('wh_products',{_fields:'id,ProductSku,ProductName,ModelCode,BrandCode'},progress);
   const details=[];
   const orderIds=orders.map(o=>o.AppOrderId);if(new Set(orderIds).size!==orderIds.length||orderIds.some(v=>!v||String(v).includes(',')))throw Error('Mã đơn nguồn bị thiếu hoặc trùng.');
   for(let i=0;i<orderIds.length;i+=40)details.push(...await this.list('wh_sales_order_details',{AppOrderId:orderIds.slice(i,i+40).join(',')},progress));
   const allowedIds=new Set(orderIds);if(details.some(l=>!allowedIds.has(l.AppOrderId)))throw Error('API chưa áp dụng đúng bộ lọc chi tiết đơn.');
   return buildSnapshot({orders,details,customers,products,start,end,staff:staff.trim()});
  }
 }
 function uniqueMap(rows,field){const m=new Map();for(const r of rows){if(!r[field]||m.has(r[field]))throw Error('Danh mục thiếu/trùng '+field+'. Cần đối soát mã trước khi nhập.');m.set(r[field],r);}return m;}
 function buildSnapshot({orders,details,customers,products,start,end,staff=''}){
  const cm=uniqueMap(customers,'CustomerCode'),pm=uniqueMap(products,'ProductSku'),groups=new Map();
  for(const l of details){if(!groups.has(l.AppOrderId))groups.set(l.AppOrderId,[]);groups.get(l.AppOrderId).push(l);}
  const lines=[],issues=[],statuses=new Set();
  for(const o of orders){
   const ls=groups.get(o.AppOrderId)||[],customer=cm.get(o.CustomerCode),total=number(o.TotalAmount),goods=number(o.TotalGoodsAmount),discount=number(o.TotalDiscount);
   const calculated=ls.reduce((n,l)=>n+number(l.Quantity)*number(l.UnitPrice),0),paid=ls.filter(l=>!l.IsGift&&number(l.Quantity)>0);
   const problems=[];
   if(!customer)problems.push('Chưa khớp mã khách');if(!ls.length)problems.push('Thiếu chi tiết');
   if(o.temp?.TotalLine!=null&&number(o.temp.TotalLine)!==ls.length)problems.push('Số dòng khác đầu đơn');
   if(total<=0||!Number.isSafeInteger(total))problems.push('Tiền đơn không dương / không phải số nguyên');
   if(Math.abs(calculated-goods)>0.01||Math.abs(goods-discount-total)>0.01)problems.push('Chi tiết / tiền hàng / chiết khấu không khớp');
   if(discount!==0&&paid.length!==1)problems.push('Đơn nhiều sản phẩm có chiết khấu: cần tiền thực tế từng dòng');
   if(ls.some(l=>l.IsGift&&number(l.Quantity)*number(l.UnitPrice)!==0))problems.push('Dòng quà có giá trị tiền: cần đối soát cách tính');
   if(ls.some(l=>!l.IsGift&&(number(l.Quantity)<=0||number(l.UnitPrice)<=0)))problems.push('Dòng bán có số lượng/đơn giá không dương');
   if(o.temp?.IsActive!==1)problems.push('Chưa xác minh đơn đang hiệu lực');
   const status=String(o.temp?.DocStatus??'Không có');statuses.add(status);
   if(ls.some(l=>!pm.has(l.ProductCode)))problems.push('Chưa khớp mã sản phẩm');
   if(problems.length){issues.push({order:String(o.OrderRefNo||o.AppOrderId),date:day(o.DocDate),reason:[...new Set(problems)].join('; '),total});continue;}
   for(const l of ls){
    if(l.IsGift)continue;const p=pm.get(l.ProductCode),amount=discount!==0?total:number(l.Quantity)*number(l.UnitPrice);
    if(!Number.isSafeInteger(amount)||amount<=0){issues.push({order:String(o.OrderRefNo||o.AppOrderId),date:day(o.DocDate),reason:'Dòng không có tiền dương hợp lệ',total:amount});continue;}
    lines.push({id:SOURCE+':'+l.id,sourceId:SOURCE,source:'Warehouse: '+(o.OrderRefNo||o.AppOrderId),customer:customer.CustomerName,date:day(o.DocDate),amount,product:p.ProductName+(p.ModelCode?' · '+p.ModelCode:''),brand:p.BrandCode||'',vat:false,classification:'review',cancelled:false,warehouse:{orderId:o.AppOrderId,customerCode:o.CustomerCode,productCode:l.ProductCode,status,active:o.temp?.IsActive,detailId:l.id,staff:o.SalesStaffCode||''}});
   }
  }
  return {source:SOURCE,start,end,staff,lines,issues,statuses:[...statuses].sort(),orders:orders.length,time:new Date().toISOString()};
 }
 root.VTWarehouse=Object.freeze({Client,buildSnapshot,day,SOURCE,BASE});
})(globalThis);
