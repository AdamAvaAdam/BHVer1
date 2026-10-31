import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCatalog,normalizeOrders,createWarehouseData,historyTable} from '../server/warehouse-data.mjs';
const products=[{id:1,ProductSku:'SKU1',ModelCode:'MODEL1',ProductName:'Tủ lạnh Sharp MODEL1',BrandCode:'SHARP'},{id:2,ProductSku:'SKU2',ProductName:'Máy giặt Panasonic',BrandCode:'PANASONIC'}],customers=[{id:1,CustomerCode:'C1',CustomerName:'Đại lý thử',ProvinceId:'34'}];
const order={id:1,AppOrderId:'ORDER1',OrderRefNo:'SO1',CustomerCode:'C1',SalesStaffCode:'NV1',DocDate:'2026-10-24T12:00:00+07:00',TotalAmount:'108000000',TotalGoodsAmount:'120000000',TotalDiscount:'12000000',temp:{TotalLine:'1',DocStatus:'4',IsActive:1}},detail={id:10,AppOrderId:'ORDER1',ProductCode:'SKU1',Quantity:'1',UnitPrice:'120000000',IsGift:false};
const snapshot=(orders=[order],details=[detail])=>normalizeOrders({orders,details,products,customers,start:'2026-10-01',end:'2026-10-31'});
test('canonical order TotalAmount already includes VAT; all statuses count without multiplying VAT',()=>{
 const r=snapshot([order,{...order,id:2,AppOrderId:'ORDER2',TotalAmount:'21600000',temp:{TotalLine:'1',DocStatus:'9',IsActive:1}}],[detail,{...detail,id:11,AppOrderId:'ORDER2'}]);
 assert.equal(r.totalAmount,129600000);assert.equal(r.lines.reduce((n,l)=>n+l.amount,0),r.totalAmount);assert(r.lines.every(l=>l.vat&&l.classification==='auto'));assert.deepEqual(r.statuses,['4','9']);assert(r.lines.every(l=>l.warehouse.provinceId==='34'));
});
test('missing details still count in customer order total but remain pending program classification',()=>{
 const r=snapshot([order],[]);assert.equal(r.totalAmount,108000000);assert.equal(r.lines[0].amount,108000000);assert.equal(r.lines[0].classification,'review');assert.equal(r.issues.length,1);
});
test('single product uses order header even with zero placeholders and stale detail price',()=>{
 const r=snapshot([order],[{...detail,UnitPrice:'90000000'},{...detail,id:11,ProductCode:'SKU2',Quantity:'0',UnitPrice:'0'}]);assert.equal(r.lines.length,1);assert.equal(r.lines[0].amount,108000000);assert.equal(r.lines[0].classification,'auto');
});
test('multi-product discounts are not guessed; missing money is not hidden from total',()=>{
 const r=snapshot([{...order,temp:{TotalLine:'2',DocStatus:'4'}}],[detail,{...detail,id:11,ProductCode:'SKU2',UnitPrice:'20000000'}]);assert.equal(r.lines.length,1);assert.equal(r.lines[0].classification,'review');assert.equal(r.lines[0].amount,108000000);
});
test('negative order affects net order total but requires program adjustment review',()=>{
 const r=snapshot([{...order,TotalAmount:'-100000'}]);assert.equal(r.totalAmount,-100000);assert.equal(r.lines[0].classification,'review');
});
test('catalog uses API stock only, latest snapshot by SKU, and does not invent base prices from discounts',()=>{
 const stocks=[{id:1,ProductSku:'SKU1',CloseInventory:'3',updateLatestAt:'2026-10-29T00:00:00Z'},{id:2,ProductSku:'SKU1',CloseInventory:'5',updateLatestAt:'2026-10-30T00:00:00Z'},{id:3,ItemCode:'SKU2',CloseInventory:'2',updateLatestAt:'2026-10-30T00:00:00Z'}];
 const promos=[{PromoId:'P1',PromoCode:'KM1',IsActive:1,FromDate:'2026-10-01',ToDate:'2026-10-31'}],details=[{PromoId:'P1',ProductCode:'SKU1',DiscountValue:'350000'}];const r=buildCatalog(products,stocks,promos,details,'2026-10-31');assert.equal(r.items[0].stock,5);assert.equal(r.items[1].stock,2);assert.equal(r.items[0].default.price,null);assert.equal(r.items[0].apiPromotions[0].discountValue,'350000');assert.equal(r.priceAvailable,false);
 const ambiguous=buildCatalog(products,[stocks[1],{...stocks[1],id:4,CloseInventory:'9'}]);assert.equal(ambiguous.items[0].stock,null);assert.equal(ambiguous.stock.conflicts,1);
});
test('repository reads documented Warehouse resources only and shares concurrent catalogue work',async()=>{
 const calls=[];const repo=createWarehouseData(async(resource,q)=>{calls.push(resource);let data=resource==='wh_products'?products:resource==='wh_customers'?customers:resource==='wh_stock_reports'?[{id:1,ProductSku:'SKU1',CloseInventory:'5'}]:resource==='wh_sales_orders'?[order]:resource==='wh_sales_order_details'?[detail]:[];return {data,_page:Number(q._page),_totalData:data.length,_hasNextPage:false};});
 const [a,b]=await Promise.all([repo.catalog(),repo.catalog()]);assert.equal(a,b);assert.equal(calls.filter(x=>x==='wh_products').length,1);const r=await repo.snapshot('2026-10-01','2026-10-31');assert.equal(r.totalAmount,108000000);assert.equal(historyTable(r).rows[0].c[5].v,108000000);assert(calls.every(x=>x.startsWith('wh_')));
});

test('regional snapshots filter orders upstream by customer; never request all orders for one province',async()=>{
 const calls=[];const cs=[...customers,{id:2,CustomerCode:'C2',CustomerName:'Đại lý khác',ProvinceId:'33'}];const repo=createWarehouseData(async(resource,q)=>{calls.push({resource,q});const data=resource==='wh_products'?products:resource==='wh_customers'?cs:resource==='wh_sales_orders'?[order]:resource==='wh_sales_order_details'?[detail]:[];return {data,_page:Number(q._page),_totalData:data.length,_hasNextPage:false};});
 const result=await repo.snapshot('2026-10-01','2026-10-31','','34');assert.equal(result.totalAmount,108000000);assert.equal(result.province,'34');assert.deepEqual(result.customerCodes,['C1']);assert(calls.filter(c=>c.resource==='wh_sales_orders').every(c=>c.q.CustomerCode==='C1'));
 const empty=await repo.snapshot('2026-10-01','2026-10-31','','01');assert.equal(empty.orders,0);assert.equal(empty.totalAmount,0);assert.equal(calls.filter(c=>c.resource==='wh_sales_orders').length,1);
});
