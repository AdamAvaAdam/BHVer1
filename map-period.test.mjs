import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPeriod} from '../server/period.mjs';
import {createWarehouseData} from '../server/warehouse-data.mjs';
test('calendar map periods default month, truncate current and preserve historical boundaries',()=>{
 const today='2026-10-31';assert.equal(mapPeriod({},today).start,'2026-10-01');assert.equal(mapPeriod({type:'quarter'},today).end,today);assert.equal(mapPeriod({type:'half',part:1},today).end,'2026-06-30');assert.equal(mapPeriod({type:'month',year:2024,part:2},today).end,'2024-02-29');assert(mapPeriod({part:12},today).upcoming);assert.throws(()=>mapPeriod({type:'bad'},today));assert.throws(()=>mapPeriod({part:13},today));
});
test('map revenue reads only monthly Warehouse headers; counts all statuses, VAT once, negative and midnight boundary',async()=>{
 const calls=[];const repo=createWarehouseData(async(resource,q)=>{calls.push({resource,q});const month=calls.length;const data=month===1?[{id:1,AppOrderId:'A',CustomerCode:'c1',DocDate:'2026-01-01T00:00:00+07:00',TotalAmount:'108000',temp:{DocStatus:4}},{id:2,AppOrderId:'B',CustomerCode:'C1',DocDate:'2026-01-31T23:59:59+07:00',TotalAmount:-8000,temp:{DocStatus:9}},{id:3,AppOrderId:'OUT',CustomerCode:'C1',DocDate:'2026-02-01',TotalAmount:999}]:[{id:4,AppOrderId:'C',CustomerCode:'C1',DocDate:'2026-02-01T00:00:00+07:00',TotalAmount:5000}];return {data,_page:Number(q._page),_totalData:data.length,_hasNextPage:false};});
 const r=await repo.revenue('2026-01-01','2026-02-28');assert.equal(calls.length,2);assert(calls.every(c=>c.resource==='wh_sales_orders'));assert.equal(r.totalAmount,105000);assert.equal(r.orders,3);assert.deepEqual(r.byCustomer,[['C1',{amount:105000,orders:3}]]);await repo.revenue('2026-01-01','2026-02-28');assert.equal(calls.length,2);
});
test('map revenue rejects duplicate business order codes',async()=>{
 const repo=createWarehouseData(async(resource,q)=>({data:[1,2].map(id=>({id,AppOrderId:'same',DocDate:'2026-10-01',TotalAmount:10})),_page:Number(q._page),_totalData:2,_hasNextPage:false}));await assert.rejects(repo.revenue('2026-10-01','2026-10-31'),/trùng mã/);
});
