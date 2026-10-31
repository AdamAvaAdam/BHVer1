const key=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/[\s\-‐‑–—]/g,'');
export function parsePriceCSV(text){
 if(/^\s*</.test(text))throw Error('Nguồn giá trả trang HTML thay vì CSV.');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell.trim());cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV giá chưa đóng dấu ngoặc.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 const money=v=>{const s=String(v||'').trim();if(!/^\d[\d.,\s]*(?:đ|₫|vnd)?$/i.test(s))return null;const n=Number(s.replace(/\D/g,''));return Number.isSafeInteger(n)&&n>0?n:null;};
 const offers=[];let invalid=0;
 for(const r of rows){if(!r[0]||!r[1])continue;const price=money(r[5]);if(price===null){invalid++;continue;}offers.push({sku:r[0],name:r[1],model:r[2]||r[0],basePrice:money(r[3]),promotion:r[4]||'',price,date:r[6]||'',code:r[7]||'',km:r[8]||r[7]||'Giá bảng tính'});}
 if(!offers.length)throw Error('Bảng giá chưa có dòng giá cuối F hợp lệ.');return {offers,invalid};
}
export function mergeSheetPrices(catalog,prices){
 const bySku=new Map(),byModel=new Map();for(const p of prices.offers){const k=key(p.sku);if(!bySku.has(k))bySku.set(k,[]);bySku.get(k).push(p);const m=key(p.model);if(!byModel.has(m))byModel.set(m,new Set());byModel.get(m).add(k);}
 let matched=0;const used=new Set(),modelCounts=new Map();for(const i of catalog.items)modelCounts.set(key(i.model),(modelCounts.get(key(i.model))||0)+1);
 const items=catalog.items.map(i=>{let k=key(i.sku);if(!bySku.has(k)){const candidates=byModel.get(key(i.model));if(candidates?.size===1&&modelCounts.get(key(i.model))===1)k=[...candidates][0];}const ps=bySku.get(k);if(!ps)return {...i,programs:[],apiPromotions:[]};used.add(k);matched++;
  const programs=ps.map((p,n)=>({id:'sheet:price:'+key(i.sku)+':'+n+':'+p.code,price:p.price,basePrice:p.basePrice,promotion:p.promotion,km:p.km,date:p.date,newToday:false,source:'Google Sheets'})).sort((a,b)=>b.price-a.price);
  const preferred=programs.find(p=>p.km.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('le'))||programs[0];
  return {...i,programs,default:preferred,min:Math.min(...programs.map(p=>p.price)),apiPriceMissing:false,priceSource:'Google Sheets',apiPromotions:[]};
 });
 return {...catalog,items,priceAvailable:matched>0,priceSource:'Google Sheets',priceInfo:{name:prices.name,time:prices.time,matched,unmatched:bySku.size-used.size,invalid:prices.invalid},notice:'Giá: '+prices.name+' từ trang tính cũ (F là giá cuối, không trừ E lần nữa). Tồn: Warehouse API. '+matched+' sản phẩm khớp giá.'};
}
export function createSheetPrices({spreadsheetId,tabsURL,fetcher=fetch}){
 let cached=null,pending=null;
 async function getText(target){let u=new URL(target);for(let hop=0;hop<5;hop++){
  if(u.protocol!=='https:'||u.username||u.password||!['docs.google.com','script.google.com','script.googleusercontent.com'].includes(u.hostname)&&!u.hostname.endsWith('.googleusercontent.com'))throw Error('Chuyển hướng nguồn giá không được phép.');
  const r=await fetcher(u,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(30000)});if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location)throw Error('Nguồn giá chuyển hướng thiếu địa chỉ.');u=new URL(location,u);continue;}if(!r.ok)throw Error('Chưa đọc được bảng giá ('+r.status+').');const reader=r.body.getReader(),parts=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw Error('Bảng giá quá lớn.');}parts.push(Buffer.from(value));}return Buffer.concat(parts).toString('utf8');
 }throw Error('Nguồn giá chuyển hướng quá nhiều lần.');}
 return async function prices(){if(cached&&Date.now()-cached.at<60000)return cached.value;if(pending)return pending;
 pending=(async()=>{if(!/^[A-Za-z0-9_-]{25,100}$/.test(spreadsheetId||''))throw Error('Chưa cấu hình trang tính bảng giá riêng trên máy chủ.');const u=new URL(tabsURL);if(u.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)||u.search||u.hash)throw Error('Nguồn chọn tab giá không hợp lệ.');const metadata=JSON.parse(await getText(u));if(metadata.ok!==true||metadata.spreadsheetId!==spreadsheetId||!Number.isSafeInteger(metadata.latest?.id)||metadata.latest.id<0)throw Error('Nguồn chọn tab không trỏ đúng bảng giá.');const csv=await getText('https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/export?'+new URLSearchParams({format:'csv',gid:String(metadata.latest.id)}));const value={...parsePriceCSV(csv),name:String(metadata.latest.name||'Bảng giá hiện hành'),time:new Date().toISOString()};cached={at:Date.now(),value};return value;})();try{return await pending;}finally{pending=null;}
 };
}
