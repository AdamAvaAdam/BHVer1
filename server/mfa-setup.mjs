import {randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../.env',import.meta.url),text=await readFile(file,'utf8');
if(/^ADMIN_TOTP_SECRET=\S+/m.test(text))throw Error('2FA đã được cấu hình. Không tự thay khóa đang dùng.');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=[...randomBytes(20)].map(n=>n.toString(2).padStart(8,'0')).join('');let secret='';for(let i=0;i<bits.length;i+=5)secret+=alphabet[parseInt(bits.slice(i,i+5),2)];
await writeFile(file,text.replace(/^ADMIN_TOTP_SECRET=.*$/m,'ADMIN_TOTP_SECRET='+secret).replace(/^REQUIRE_OTP=.*$/m,'REQUIRE_OTP=true'),{mode:0o600});
console.log('Đã bật 2FA. Trên máy riêng, thêm tài khoản TOTP vào ứng dụng Authenticator bằng mã thiết lập sau. Không đưa mã này lên GitHub:');console.log(secret);console.log('Tài khoản: Việt Tuấn Admin; 6 số; chu kỳ 30 giây. Khởi động lại máy chủ sau khi thêm Authenticator.');
