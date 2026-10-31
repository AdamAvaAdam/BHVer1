module.exports=function(s){
 s=s.replace('const wasOpen=previous?previous.open:true;','const wasOpen=previous?previous.open:false;');
 const start=s.indexOf('async function loadBoard(){'),end=s.indexOf("\n$A('boardReload')",start);if(start<0||end<0)throw Error('Recommendation anchors changed');
 const loader=String.raw`let boardGeneration=0;
async function loadBoard(){
 const province=parent.vtRecommendationProvince||'',generation=++boardGeneration;state.orders=[];state.ordersFresh=false;state.history=null;state.recommendations=[];state.customers=new Map();state.weatherMap=new Map();state.generation++;state.weatherBusy=false;
 if(!province){state.busy=false;state.ordersStatus='Chọn khu vực trong tab Gợi ý bán hàng để tải lịch sử.';renderBoard();return;}
 state.busy=true;state.ordersStatus='Đang đọc lịch sử của '+(parent.vtProvinceLabel?.(province)||province)+'…';renderBoard();
 const results=await Promise.allSettled([readSheet('912353833'),readSheet('1701246983')]);
 if(generation!==boardGeneration||province!==parent.vtRecommendationProvince)return;
 if(results[0].status==='fulfilled'){try{const parsed=E.parseOrders(results[0].value);state.orders=parsed.lines;state.orderInfo=parsed;state.ordersFresh=true;state.lastSync=new Date();state.ordersStatus=parsed.lines.length+' dòng bán · '+(parent.vtProvinceLabel?.(province)||province)+(results[0].value.truncated?' · lịch sử bị giới hạn':'');}catch(e){state.ordersStatus='Chưa phân tích được lịch sử khu vực: '+e.message;}}else state.ordersStatus='Chưa đọc được lịch sử khu vực. Bấm cập nhật để thử lại.';
 if(results[1].status==='fulfilled'){try{state.customers=E.parseCustomers(results[1].value);state.customerStatus=state.customers.size+' khách thuộc khu vực';}catch{state.customerStatus='Chưa đọc được danh sách khách khu vực';}}
 state.busy=false;renderBoard();loadWeather();
}
window.VTRecommendations={refresh:loadBoard,scopeChanged:loadBoard,setMode(mode){document.body.dataset.view=mode;}};`;
 s=s.slice(0,start)+loader+s.slice(end);
 s=s.replace("'/api/warehouse/customers'","'/api/warehouse/customers?province='+encodeURIComponent(parent.vtRecommendationProvince||'')");
 s=s.replace("if(gid!=='1701246983')throw Error('Nguồn không hỗ trợ.');","if(gid!=='1701246983')throw Error('Nguồn không hỗ trợ.');if(!parent.vtRecommendationProvince)throw Error('Chọn khu vực trước.');");
 s=s.replace('fresh:state.ordersFresh,stockFresh}),available=', 'fresh:state.ordersFresh,stockFresh}).filter(c=>state.customers.has(E.normalize(c.name))),available=');
 s=s.replace("(!state.ordersFresh?'Lịch sử chưa cập nhật. ':'')", "(parent.vtRecommendationProvince?'Khu vực: '+(parent.vtProvinceLabel?.(parent.vtRecommendationProvince)||parent.vtRecommendationProvince)+' · ':'Chọn khu vực riêng của Gợi ý bán hàng. ')+(!state.ordersFresh?'Lịch sử chưa cập nhật. ':'')");
 s=s.replace('function renderProgramTargets(){',"function renderProgramTargets(){try{drawProgramTargets();}catch(e){$A('programTargetStatus').textContent='Chưa đánh giá được chương trình: '+e.message;}}\nfunction drawProgramTargets(){");

 s=s.replace('function findInCatalog(p){',"function findInCatalog(p){if(parent!==window&&typeof parent.tab==='function')parent.tab('sales');");
 const scopeNames=require('./source/provinces.cjs');
 const scopeUI='<aside id="recommendation-scope"><h2>Gợi ý bán hàng</h2><label>Khu vực khách hàng<select id="recommendation-province"><option value="">Chọn tỉnh cũ…</option><option value="all">Tất cả khu vực</option>'+Object.entries(scopeNames).map(([code,name])=>'<option value="'+code+'">'+name+'</option>').join('')+'</select></label><p>Chỉ tải lịch sử sau khi chọn khu vực. Bộ lọc này độc lập với Doanh số và Bản đồ.</p><button id="recommendation-refresh">Cập nhật gợi ý</button></aside>';
 s=s.replace("main.append(catalog,host);", "main.append(catalog,host);main.insertAdjacentHTML('afterbegin',"+JSON.stringify(scopeUI)+");document.getElementById('recommendation-province').onchange=e=>{parent.vtRecommendationProvince=e.target.value;loadBoard();};document.getElementById('recommendation-refresh').onclick=loadBoard;document.body.dataset.view='catalog';");
 s=s.replace('</style>', '<style-replaced></style>');
 s=s.replace('<style-replaced>', 'body[data-view="catalog"] #advisor,body[data-view="catalog"] #recommendation-scope{display:none!important}body[data-view="catalog"] main.split-workspace{grid-template-columns:1fr}body[data-view="catalog"]>footer{width:100%}body[data-view="recommendations"] #catalogPane,body[data-view="recommendations"]>footer{display:none!important}body[data-view="recommendations"] main.split-workspace{grid-template-columns:230px minmax(0,1fr)}body[data-view="recommendations"] #advisor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#recommendation-scope{padding:20px;background:#f7fafc;border-right:1px solid #d5dfeb;overflow:auto}#recommendation-scope h2{font-size:18px}#recommendation-scope label{display:grid;gap:10px;font-size:12px}#recommendation-scope select{width:100%;min-width:0}#recommendation-scope p{font-size:12px;color:#64788e;line-height:1.8}body[data-view="recommendations"] .program-target-panel,body[data-view="recommendations"] .top10-pane{overflow:auto;min-height:0;max-height:none}@media(max-width:900px){body[data-view="recommendations"] main.split-workspace{grid-template-columns:180px minmax(0,1fr)}body[data-view="recommendations"] #advisor{display:block;overflow:auto}}@media(max-width:600px){body[data-view="recommendations"] main.split-workspace{display:block;overflow:auto}#recommendation-scope{padding:12px}body[data-view="recommendations"] #advisor{overflow:visible}}');
 return s;
};
