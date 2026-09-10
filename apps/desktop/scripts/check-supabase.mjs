import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
if (!fs.existsSync(envPath)) { console.error("Missing apps/desktop/.env.local. Copy .env.example and add your Supabase values."); process.exit(1); }
const env=Object.fromEntries(fs.readFileSync(envPath,"utf8").split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith("#")&&line.includes("=")).map((line)=>{const separator=line.indexOf("=");return[line.slice(0,separator),line.slice(separator+1).replace(/^['"]|['"]$/g,"")];}));
const url=env.VITE_SUPABASE_URL?.replace(/\/$/,"");const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){console.error("VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is invalid.");process.exit(1);}
const headers={apikey:key,authorization:`Bearer ${key}`};
async function request(label,endpoint,init={},accepted=[200]){const response=await fetch(`${url}${endpoint}`,{...init,headers:{...headers,...init.headers}});const text=await response.text();if(!accepted.includes(response.status))throw new Error(`${label} failed (${response.status}): ${text.slice(0,300)}`);console.log(`✓ ${label}`);return{text,status:response.status};}
async function privateList(label,endpoint,init={}){const response=await fetch(`${url}${endpoint}`,{...init,headers:{...headers,...init.headers}});const text=await response.text();if([400,401,403].includes(response.status)){console.log(`✓ ${label}`);return;}if(response.status===200){let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`${label} returned invalid JSON.`);}if(Array.isArray(parsed)&&parsed.length===0){console.log(`✓ ${label}`);return;}}throw new Error(`${label} exposed data or returned an unexpected response (${response.status}): ${text.slice(0,300)}`);}

try{
  await request("Auth endpoint","/auth/v1/health");
  await request("Anonymous community catalog","/rest/v1/community_catalog?select=release_id&limit=1");
  await request("Private download history","/rest/v1/package_downloads?select=release_id&limit=1",{},[401,403]);
  await privateList("Private package bucket","/storage/v1/object/list/user-packages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prefix:"releases",limit:1,offset:0})});
  const missingRelease="00000000-0000-0000-0000-000000000000";
  const download=await request("Anonymous download function","/functions/v1/package-download",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease})},[404]);
  if(!/not found/i.test(download.text))throw new Error("Download function returned an unexpected response.");
  await request("Protected upload function","/functions/v1/finalize-package-upload",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:"staging/test.surreality"})},[401]);
  await request("Protected moderation function","/functions/v1/moderate-package",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease,action:"approve"})},[401]);
  await request("Protected report function","/functions/v1/report-package",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease,reason:"test"})},[401]);
  await request("Protected thumbnail function","/functions/v1/update-release-thumbnail",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease,mimeType:"image/png",data:""})},[401]);
  await request("Protected listing editor","/functions/v1/update-release-listing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease,name:"Test",description:""})},[401]);
  await request("Protected save function","/functions/v1/save-package",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({releaseId:missingRelease,saved:true})},[401]);
  console.log("Supabase community library is reachable and its public/private boundaries passed.");
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exit(1);}
