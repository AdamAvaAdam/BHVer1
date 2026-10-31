import {writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import readline from 'node:readline';
import {passwordHash} from './crypto.mjs';
const file=new URL('../.env',import.meta.url);
try{await access(file);throw Error('.env đã tồn tại. Không ghi đè cấu hình đang dùng.');}catch(e){if(e.code!=='ENOENT')throw e;}
const lines=readline.createInterface({input:process.stdin,output:process.stdout,terminal:false});
console.log('Nhập lần lượt 3 dòng: mật khẩu Admin, khóa Warehouse, PUBLIC_ORIGIN (ví dụ http://127.0.0.1:8080). Nội dung nhập sẽ không được hiển thị lại.');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const answers=[];
for await(const line of lines){answers.push(line.trim());if(answers.length===3)break;}
if(process.stdin.isTTY)process.stdin.setRawMode(false);
if(answers.length!==3||answers[0].length<15||!/^sk-[A-Za-z0-9_-]{20,}$/.test(answers[1]))throw Error('Thiếu cấu hình hợp lệ. Mật khẩu cần ít nhất 15 ký tự.');
const origin=new URL(answers[2]);if(origin.origin!==answers[2]||origin.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw Error('Tên miền phải HTTPS; localhost được dùng HTTP.');
const text=['PUBLIC_ORIGIN='+origin.origin,'APP_DOMAIN='+origin.hostname,'HOST=127.0.0.1','PORT='+Number(origin.port||8080),'ADMIN_PASSWORD_HASH='+await passwordHash(answers[0]),'DATA_KEY='+randomBytes(32).toString('base64'),'WAREHOUSE_API_KEY='+answers[1],'ADMIN_TOTP_SECRET=','REQUIRE_OTP=false',''].join('\n');
await writeFile(file,text,{mode:0o600,flag:'wx'});answers.fill('');lines.close();process.stdin.pause();console.log('Đã lưu cấu hình riêng .env. Tệp này bị loại khỏi Git và bộ bàn giao.');
