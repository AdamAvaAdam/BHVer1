import {createApp} from './app.mjs';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const manifest=JSON.parse(await readFile(new URL('../private/sources.json',import.meta.url),'utf8')),sourceIDs=Array.isArray(manifest)?manifest:manifest.sheets;
const env={...(process.env.PRIVATE_CONFIG_FILE?parseEnv(await readFile(process.env.PRIVATE_CONFIG_FILE,'utf8')):{}),...process.env};
const origin=env.PUBLIC_ORIGIN||'http://127.0.0.1:8080';
const server=await createApp({origin,passwordHash:env.ADMIN_PASSWORD_HASH,dataKey:env.DATA_KEY,warehouseKey:env.WAREHOUSE_API_KEY,priceSpreadsheetId:env.PRICE_SPREADSHEET_ID,priceTabsURL:env.PRICE_TABS_URL,mapCSVURL:env.MAP_CSV_URL,totpSecret:env.ADMIN_TOTP_SECRET||'',requireOTP:env.REQUIRE_OTP==='true',sourceIDs,appsScriptURLs:manifest.scripts||[],appsScriptURL:env.APPS_SCRIPT_URL||'',dataDir:env.DATA_DIR});
server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('Việt Tuấn Admin đã sẵn sàng tại '+origin));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
