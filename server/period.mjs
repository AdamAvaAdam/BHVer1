export const todayVN=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function mapPeriod(input={},today=todayVN()){
 const nowYear=Number(today.slice(0,4)),nowMonth=Number(today.slice(5,7)),type=input.type||'month';
 const limits={month:12,quarter:4,half:2,year:1};if(!Object.hasOwn(limits,type))throw Error('Loại kỳ không hợp lệ.');
 const y=input.year==null?nowYear:Number(input.year),defaultPart=type==='month'?nowMonth:type==='quarter'?Math.ceil(nowMonth/3):type==='half'?Math.ceil(nowMonth/6):1,p=input.part==null?defaultPart:Number(input.part);
 if(!Number.isInteger(y)||y<2000||y>nowYear||!Number.isInteger(p)||p<1||p>limits[type])throw Error('Năm hoặc kỳ không hợp lệ.');
 const months=type==='month'?1:type==='quarter'?3:type==='half'?6:12,m=(p-1)*months+1;
 const start=y+'-'+String(m).padStart(2,'0')+'-01',naturalEnd=new Date(Date.UTC(y,m+months-1,0)).toISOString().slice(0,10),end=naturalEnd>today?today:naturalEnd;
 return {type,year:y,part:p,start,end,naturalEnd,upcoming:start>today,current:start<=today&&naturalEnd>=today,label:type==='month'?'Tháng '+p+'/'+y:type==='quarter'?'Quý '+p+'/'+y:type==='half'?(p===1?'6 tháng đầu ':'6 tháng cuối ')+y:'Năm '+y};
}
