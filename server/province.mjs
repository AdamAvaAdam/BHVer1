import names from '../source/provinces.cjs';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/^(tinh|thanh pho|tp\.?)[\s]+/,'').replace(/[^a-z0-9]/g,'');
export function provinceCode(raw){const v=String(raw||'').trim();if(!v)return 'unknown';if(/^\d{1,2}$/.test(v)){const c=v.padStart(2,'0');return names[c]?c:'other:'+v;}const alias={HN:'01',HCM:'79',HP:'31',DN:'48',CT:'92'};return alias[v.toUpperCase()]||Object.entries(names).find(([,name])=>norm(name)===norm(v))?.[0]||'other:'+v;}
