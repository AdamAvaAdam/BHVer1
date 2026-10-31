import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {mapDealers,mapServiceURL,createMapData,joinMapData} from '../server/map-data.mjs';
const require=createRequire(import.meta.url);
test('recommendations reload selected area, clear old evidence and ignore late responses from prior area',async()=>{
 const transformed=require('../recommendation-transform.cjs')('async function loadBoard(){old();}\n$A(\'boardReload\')');const loader=transformed.slice(0,transformed.indexOf("\n$A('boardReload')"));
 const pending=new Map(),calls=[];const c={Map,Promise,parent:{vtRecommendationProvince:'',vtProvinceLabel:v=>v},state:{orders:[{name:'old'}],customers:new Map(),weatherMap:new Map(),generation:0},E:{parseOrders:v=>v,parseCustomers:v=>v},renderBoard(){},loadWeather(){},readSheet(gid){const key=c.parent.vtRecommendationProvince+':'+gid;calls.push(key);return new Promise(resolve=>pending.set(key,resolve));}};c.window=c;vm.createContext(c);vm.runInContext(loader,c);
 await c.VTRecommendations.refresh();assert.equal(calls.length,0);assert.equal(c.state.orders.length,0);
 c.parent.vtRecommendationProvince='34';const a=c.VTRecommendations.scopeChanged();c.parent.vtRecommendationProvince='33';const b=c.VTRecommendations.scopeChanged();assert.equal(c.state.orders.length,0);
 pending.get('33:912353833')({lines:[{name:'Hưng Yên'}]});pending.get('33:1701246983')(new Map([['hy',{}]]));await b;assert.equal(c.state.orders[0].name,'Hưng Yên');
 pending.get('34:912353833')({lines:[{name:'Thái Bình'}]});pending.get('34:1701246983')(new Map([['tb',{}]]));await a;assert.equal(c.state.orders[0].name,'Hưng Yên');assert(c.state.ordersFresh);
});
test('map coordinates ignore sheet money; Warehouse code join reconciles all customers exactly once',()=>{
 const locations=mapDealers('Code,Name,Address,Lon,Lat,Revenue\nC1,A,Thái Bình,106.2,20.4,999999999\nC1,A,Thái Bình,106.2,20.4,999999999\nC2,B,Thái Bình,106.2,20.4,999999999\nX,Unknown,,106.1,20.5,1\nC3,C,,,,5000');
 assert.equal(locations.data[0].s,undefined);assert.equal(locations.missingCoordinates,1);
 const r=joinMapData(locations,[{CustomerCode:'C1'},{CustomerCode:'C2'},{CustomerCode:'C3'}],{byCustomer:[['C1',{amount:100,orders:1}],['C2',{amount:-20,orders:1}],['C3',{amount:70,orders:1}],['OTHER',{amount:10,orders:1}]],totalAmount:160,orders:4,time:'2026-10-31'},{});
 assert.equal(r.data.length,2);assert.equal(r.data[0].s,100);assert.equal(r.data[1].s,-20);assert.equal(r.unlocated[0].s,70);assert.equal(r.unmatchedLocations.length,1);assert.equal(r.duplicateCodes,1);assert.equal(r.totals.locatedAmount+r.totals.unlocatedAmount+r.totals.unknownAmount,160);
});
test('map services allow only documented map functions, not arbitrary URLs or internal network redirects',()=>{
 assert.equal(mapServiceURL('https://router.project-osrm.org/trip/v1/driving/106.1,20.4;106.2,20.5?roundtrip=false&geometries=geojson').hostname,'router.project-osrm.org');
 for(const url of ['http://127.0.0.1/private','https://example.com/?q=coords','https://router.project-osrm.org/admin','https://user:pass@router.project-osrm.org/table/v1/driving/106,20'])assert.throws(()=>mapServiceURL(url));
});
test('map loads all coordinate rows without a region and rejects non-Google redirects',async()=>{
 let calls=0;const read=createMapData('https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv',async()=>{calls++;return new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}});});await assert.rejects(read(),/không được phép/);assert.equal(calls,1);
});
