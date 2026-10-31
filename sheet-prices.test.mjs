import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePriceCSV,mergeSheetPrices,createSheetPrices} from '../server/sheet-prices.mjs';
test('D is original price, E is promotion, F is final price; no double discount',()=>{
 const p=parsePriceCSV('Group,,,,,,,,\r\nSKU1,Product,MODEL,6.000.000,300.000,5.700.000,31/10/26,CT1,"Gói 5, đủ bộ"\r\nSKU1,Product,MODEL,6.000.000,,6.000.000,31/10/26,CT2,Lẻ');
 assert.equal(p.offers.length,2);assert.equal(p.offers[0].basePrice,6000000);assert.equal(p.offers[0].promotion,'300.000');assert.equal(p.offers[0].price,5700000);assert.equal(p.offers[0].km,'Gói 5, đủ bộ');
 const merged=mergeSheetPrices({items:[{sku:'SKU1',model:'MODEL',stock:7,apiPriceMissing:true,programs:[]}]},p);assert.equal(merged.items[0].stock,7);assert.equal(merged.items[0].programs.length,2);assert.equal(merged.items[0].min,5700000);assert.equal(merged.items[0].default.price,6000000);assert.equal(merged.items[0].apiPriceMissing,false);
});
test('missing price and ambiguous model are never guessed or allowed to quote',()=>{
 const p={offers:[{sku:'OTHER',model:'SAME',price:1000000}],name:'Test',time:'now'};const r=mergeSheetPrices({items:[{sku:'A',model:'SAME',stock:1,apiPriceMissing:true},{sku:'B',model:'SAME',stock:2,apiPriceMissing:true}]},p);assert.equal(r.priceInfo.matched,0);assert(r.items.every(i=>i.apiPriceMissing));assert.throws(()=>parsePriceCSV('<html>Sign in</html>'));assert.throws(()=>parsePriceCSV('SKU,Name,M,1,0,invalid'));
});
const id='TEST_SHEET_IDENTIFIER_1234567890',tabs='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
test('server reads only newest price tab in configured sheet and caches concurrent requests',async()=>{
 const calls=[];const read=createSheetPrices({spreadsheetId:id,tabsURL:tabs,fetcher:async u=>{u=new URL(u);calls.push(u);return new Response(u.hostname==='script.google.com'?JSON.stringify({ok:true,spreadsheetId:id,latest:{id:42,name:'Giá mới'},stock:{id:999}}):'SKU,Name,M,1000000,100000,900000,31/10/26,CT,Lẻ');}});
 const [a,b]=await Promise.all([read(),read()]);assert.equal(a,b);assert.equal(calls.length,2);assert.equal(calls[1].searchParams.get('gid'),'42');assert.equal(a.offers[0].price,900000);assert(!JSON.stringify(a).includes(id));
});
test('rejects foreign metadata and redirects to internal network before requesting it',async()=>{
 const wrong=createSheetPrices({spreadsheetId:id,tabsURL:tabs,fetcher:async()=>new Response(JSON.stringify({ok:true,spreadsheetId:'OTHER',latest:{id:42}}))});await assert.rejects(wrong(),/đúng bảng giá/);
 let calls=0;const redirected=createSheetPrices({spreadsheetId:id,tabsURL:tabs,fetcher:async()=>{calls++;return new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}});}});await assert.rejects(redirected(),/không được phép/);assert.equal(calls,1);
});
