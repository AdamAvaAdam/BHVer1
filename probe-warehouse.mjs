import {readFile,writeFile} from 'node:fs/promises';
import readline from 'node:readline';
const base='https://warehouseapi.huonganhgroup.vn/v1',file=new URL('../.env',import.meta.url);
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const input=readline.createInterface({input:process.stdin,terminal:false});console.log('Nhận khóa mới trong bộ nhớ; chỉ đọc các resource Warehouse đã có tài liệu.');
input.once('line',async key=>{
 try{
  const r=await fetch(base+'/auth/api_key_login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secretKey:key}),signal:AbortSignal.timeout(30000)}),session=await r.json();if(!r.ok||!session.accessToken?.token)throw Error('Khóa chưa xác thực được ('+r.status+').');
  let env=await readFile(file,'utf8');env=env.replace(/^WAREHOUSE_API_KEY=.*$/m,'WAREHOUSE_API_KEY='+key.trim());await writeFile(file,env,{mode:0o600});key='';console.log('NEW_KEY_AUTHENTICATED_AND_CONFIGURED');
  const report=[];
  for(const resource of ['wh_products','wh_stock_reports','wh_promotions','wh_promotion_details','wh_warehouses','wh_sales_orders','wh_sales_order_details','wh_invoices','wh_invoice_details']){
   const q=new URLSearchParams({_page:'1',_limit:resource==='wh_products'||resource==='wh_stock_reports'?'200':'20',_orderBy:'id:desc'}),res=await fetch(base+'/'+resource+'/paginate?'+q,{headers:{Authorization:'Bearer '+session.accessToken.token},signal:AbortSignal.timeout(30000)});const data=await res.json(),rows=data.data||[];
   const fields=[...new Set(rows.flatMap(o=>Object.keys(o)))],tempFields=[...new Set(rows.flatMap(o=>Object.keys(o.temp||{})))];
   const entry={resource,status:res.status,total:data._totalData,fields,tempFields,moneySamples:rows.slice(0,3).map(o=>Object.fromEntries(Object.entries(o).filter(([k,v])=>/price|amount|discount|vat|inventory|date/i.test(k)&&k!=='TaxCode'&&v!==null))),tempSamples:rows.slice(0,2).map(o=>Object.fromEntries(Object.entries(o.temp||{}).filter(([k])=>/price|amount|discount|tax|inventory|date|warehouse|branch|status|line/i.test(k))))};
   report.push(entry);console.log(JSON.stringify(entry));
  }
  await writeFile(new URL('../warehouse-schema-report.json',import.meta.url),JSON.stringify(report,null,2));
 }catch(e){console.log('PROBE_FAILED: '+e.message);process.exitCode=1;}finally{input.close();process.stdin.pause();}
});
