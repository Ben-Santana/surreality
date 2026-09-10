import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import type { SafeStorage } from "electron";
import type { CloudState, CommunityBrowseOptions, CommunityBrowseResult, CommunityProgress, CommunityRelease, CustomMappingPackageManifest } from "../src/types";
import { LocalDataStore } from "./persistence";

type Notify = (state: CloudState) => void;
type ProgressNotify = (progress: CommunityProgress) => void;
type JsonRecord = Record<string, unknown>;

class EncryptedSessionStorage {
  private values: Record<string, string> = {};
  private readonly filePath: string;
  constructor(userDataPath: string, private readonly safeStorage: SafeStorage) { this.filePath=path.join(userDataPath,"data","session.bin"); this.load(); }
  private load(){if(!fs.existsSync(this.filePath)||!this.safeStorage.isEncryptionAvailable())return;try{const parsed=JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.filePath))) as unknown;if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))this.values=parsed as Record<string,string>;}catch{this.values={};}}
  private save(){if(!this.safeStorage.isEncryptionAvailable())return;fs.mkdirSync(path.dirname(this.filePath),{recursive:true});const temporary=`${this.filePath}.tmp`;fs.writeFileSync(temporary,this.safeStorage.encryptString(JSON.stringify(this.values)),{mode:0o600});fs.renameSync(temporary,this.filePath);}
  getItem(key:string){return Promise.resolve(this.values[key]??null);} setItem(key:string,value:string){this.values[key]=value;this.save();return Promise.resolve();} removeItem(key:string){delete this.values[key];this.save();return Promise.resolve();}
}

function record(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function rowRelease(row: JsonRecord, local: LocalDataStore, publisher = "you"): CommunityRelease {
  const manifest = (record(row.manifest) ? row.manifest : {}) as CustomMappingPackageManifest;
  const sha256 = String(row.sha256 ?? "");
  const joinedProfile = record(row.profiles) ? row.profiles.username : null;
  return {
    releaseId: String(row.release_id ?? row.id ?? ""), packageId: String(row.package_id ?? manifest.id ?? ""), version: String(row.version ?? manifest.version ?? ""),
    manifest, sha256, byteSize: Number(row.byte_size ?? 0), publisherUsername: String(row.publisher_username ?? joinedProfile ?? publisher),
    status: String(row.status ?? "published") as CommunityRelease["status"], statusReason: row.status_reason == null ? null : String(row.status_reason),
    approvedNative: Boolean(row.approved_native), publishedAt: row.published_at == null ? null : String(row.published_at),
    createdAt: String(row.created_at ?? row.published_at ?? new Date(0).toISOString()), installed: local.hasPackageHash(sha256),
  };
}

export class CloudService {
  private client: SupabaseClient | null = null;
  private projectUrl = "";
  private publishableKey = "";
  private user: CloudState["user"] = null;
  private profile: CloudState["profile"] = null;
  private lastError: string | null = null;
  private readonly sessionStorage: EncryptedSessionStorage;
  constructor(private readonly local: LocalDataStore,userDataPath:string,safeStorage:SafeStorage,private readonly notify:Notify,private readonly progressNotify:ProgressNotify){this.sessionStorage=new EncryptedSessionStorage(userDataPath,safeStorage);}

  async configure(url:string,publishableKey:string){if(this.client)return this.state();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!publishableKey.trim())return this.state();this.projectUrl=url.replace(/\/$/,"");this.publishableKey=publishableKey;this.client=createClient(this.projectUrl,publishableKey,{auth:{storage:this.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"pkce"}});this.client.auth.onAuthStateChange((_event,session)=>{this.user=session?.user?{id:session.user.id,email:session.user.email??null}:null;if(!session?.user)this.profile=null;this.emit();if(session?.user)queueMicrotask(()=>void this.refreshProfile());});const{data,error}=await this.client.auth.getSession();if(error)this.lastError=error.message;this.user=data.session?.user?{id:data.session.user.id,email:data.session.user.email??null}:null;if(this.user)await this.refreshProfile();this.emit();return this.state();}
  state():CloudState{return{configured:this.client!=null,user:this.user,profile:this.profile,lastError:this.lastError};}
  private release(row:JsonRecord,publisher="you"){
    const release=rowRelease(row,this.local,publisher);
    const thumbnailPath=typeof row.thumbnail_path==="string"?row.thumbnail_path:"";
    return{
      ...release,
      owned:Boolean(row.owned)||(typeof row.owner_id==="string"&&row.owner_id===this.user?.id),
      ...(typeof row.listing_name==="string"?{listingName:row.listing_name}:{}),
      ...(typeof row.listing_description==="string"?{listingDescription:row.listing_description}:{}),
      saved:Boolean(row.saved),
      ...(thumbnailPath?{thumbnailUrl:`${this.projectUrl}/storage/v1/object/public/package-thumbnails/${thumbnailPath.split("/").map(encodeURIComponent).join("/")}`}:{})
    };
  }
  private emit(){this.notify(this.state());}
  private async refreshProfile(){if(!this.client||!this.user)return;const[profile,admin]=await Promise.all([this.client.from("profiles").select("username").eq("id",this.user.id).single(),this.client.from("app_admins").select("user_id").eq("user_id",this.user.id).maybeSingle()]);if(profile.error){this.lastError=profile.error.message;return;}this.profile={username:profile.data.username??null,isAdmin:Boolean(admin.data)};this.emit();}
  async signUp(email:string,password:string){if(!this.client)throw new Error("Supabase is not configured.");const result=await this.client.auth.signUp({email,password});if(result.error)throw result.error;return{needsEmailConfirmation:!result.data.session,state:this.state()};}
  async signIn(email:string,password:string){if(!this.client)throw new Error("Supabase is not configured.");const result=await this.client.auth.signInWithPassword({email,password});if(result.error)throw result.error;this.user=result.data.user?{id:result.data.user.id,email:result.data.user.email??null}:null;await this.refreshProfile();this.emit();return this.state();}
  async signOut(){if(!this.client)return this.state();const{error}=await this.client.auth.signOut();if(error)throw error;this.user=null;this.profile=null;this.emit();return this.state();}
  async sendPasswordReset(email:string){if(!this.client)throw new Error("Supabase is not configured.");const{error}=await this.client.auth.resetPasswordForEmail(email);if(error)throw error;}
  async verifyPasswordRecovery(email:string,token:string,newPassword:string){if(!this.client)throw new Error("Supabase is not configured.");const verification=await this.client.auth.verifyOtp({email,token,type:"recovery"});if(verification.error)throw verification.error;const update=await this.client.auth.updateUser({password:newPassword});if(update.error)throw update.error;return this.state();}
  async setUsername(username:string){if(!this.client||!this.user)throw new Error("Sign in before choosing a username.");const{error}=await this.client.rpc("set_public_username",{next_username:username});if(error)throw error;await this.refreshProfile();return this.state();}

  async browse(options:CommunityBrowseOptions={}):Promise<CommunityBrowseResult>{if(!this.client)throw new Error("Supabase is not configured.");const offset=Math.max(0,Number(options.cursor??0)||0);let query=this.client.from("community_catalog").select("*").range(offset,offset+23);if(options.search?.trim()){const search=options.search.trim().replace(/[,%()]/g,"");query=query.or(`name.ilike.%${search}%,package_id.ilike.%${search}%,publisher_username.ilike.%${search}%`);}query=options.sort==="name"?query.order("name",{ascending:true}).order("version",{ascending:false}):query.order("published_at",{ascending:false});const{data,error}=await query;if(error)throw new Error(error.message);const items=(data??[]).map((row)=>this.release(row as JsonRecord));return{items,nextCursor:items.length===24?String(offset+24):null};}
  async getPackage(packageId:string){if(!this.client)throw new Error("Supabase is not configured.");const{data,error}=await this.client.from("community_catalog").select("*").eq("package_id",packageId).order("published_at",{ascending:false});if(error)throw new Error(error.message);return(data??[]).map((row)=>this.release(row as JsonRecord));}
  async listUploads(){if(!this.client||!this.user)throw new Error("Sign in to see uploads.");const{data,error}=await this.client.from("package_releases").select("*").eq("owner_id",this.user.id).order("created_at",{ascending:false});if(error)throw new Error(error.message);return(data??[]).map((row)=>this.release(row as JsonRecord,this.profile?.username??"you"));}
  async listModerationQueue(){
    if(!this.client||!this.profile?.isAdmin)throw new Error("Admin access required.");
    const releases=await this.client.from("package_releases").select("*").order("created_at",{ascending:false}).limit(200);
    if(releases.error)throw new Error(releases.error.message);
    const ownerIds=[...new Set((releases.data??[]).map((item)=>item.owner_id))];
    const profiles=ownerIds.length?await this.client.from("profiles").select("id,username").in("id",ownerIds):{data:[],error:null};
    if(profiles.error)throw new Error(profiles.error.message);
    const usernames=new Map((profiles.data??[]).map((profile)=>[profile.id,profile.username]));
    return(releases.data??[]).map((release)=>this.release({...release,publisher_username:usernames.get(release.owner_id)??"publisher"} as JsonRecord,"publisher"));
  }
  async listDownloads(){
    if(!this.client||!this.user)throw new Error("Sign in to see downloads.");
    const history=await this.client.from("package_downloads").select("release_id,first_downloaded_at,last_downloaded_at,download_count").eq("user_id",this.user.id).order("last_downloaded_at",{ascending:false});
    if(history.error)throw new Error(history.error.message);
    if(!history.data?.length)return[];
    const releaseIds=history.data.map((item)=>item.release_id);
    const releases=await this.client.from("package_releases").select("*").in("id",releaseIds);
    if(releases.error)throw new Error(releases.error.message);
    const ownerIds=[...new Set((releases.data??[]).map((item)=>item.owner_id))];
    const profiles=ownerIds.length?await this.client.from("profiles").select("id,username").in("id",ownerIds):{data:[],error:null};
    if(profiles.error)throw new Error(profiles.error.message);
    const usernames=new Map((profiles.data??[]).map((profile)=>[profile.id,profile.username]));
    const releasesById=new Map((releases.data??[]).map((release)=>[release.id,{...release,publisher_username:usernames.get(release.owner_id)??"publisher"}]));
    return history.data.flatMap((item)=>{const release=releasesById.get(item.release_id);if(!release)return[];return[{...this.release(release as JsonRecord),firstDownloadedAt:String(item.first_downloaded_at),lastDownloadedAt:String(item.last_downloaded_at),downloadCount:Number(item.download_count)}];});
  }
  async listSaved(){
    if(!this.client||!this.user)throw new Error("Sign in to see saved packages.");
    const saves=await this.client.from("package_saves").select("release_id,created_at").eq("user_id",this.user.id).order("created_at",{ascending:false});
    if(saves.error)throw new Error(saves.error.message);
    if(!saves.data?.length)return[];
    const releases=await this.client.from("package_releases").select("*").in("id",saves.data.map((item)=>item.release_id));
    if(releases.error)throw new Error(releases.error.message);
    const ownerIds=[...new Set((releases.data??[]).map((item)=>item.owner_id))];
    const profiles=ownerIds.length?await this.client.from("profiles").select("id,username").in("id",ownerIds):{data:[],error:null};
    if(profiles.error)throw new Error(profiles.error.message);
    const usernames=new Map((profiles.data??[]).map((profile)=>[profile.id,profile.username]));
    const byId=new Map((releases.data??[]).map((release)=>[release.id,{...release,saved:true,publisher_username:usernames.get(release.owner_id)??"publisher"}]));
    return saves.data.flatMap((save)=>{const release=byId.get(save.release_id);return release?[this.release(release as JsonRecord)]:[];});
  }

  async uploadPackage(filePath:string){if(!this.client||!this.user)throw new Error("Sign in before uploading.");if(!this.profile?.username)throw new Error("Choose a public username before uploading.");const stat=fs.statSync(filePath);if(!stat.isFile()||stat.size>50*1024*1024)throw new Error("Package is missing or larger than 50 MB.");const pathName=`staging/${this.user.id}/${crypto.randomUUID()}.surreality`;const{data:{session}}=await this.client.auth.getSession();if(!session)throw new Error("Your session expired. Sign in again.");await new Promise<void>((resolve,reject)=>{const upload=new tus.Upload(fs.createReadStream(filePath),{endpoint:`${this.projectUrl}/storage/v1/upload/resumable`,uploadSize:stat.size,retryDelays:[0,1000,3000,5000,10000],chunkSize:6*1024*1024,headers:{authorization:`Bearer ${session.access_token}`,apikey:this.publishableKey},metadata:{bucketName:"user-packages",objectName:pathName,contentType:"application/vnd.surreality.package+json",cacheControl:"3600"},removeFingerprintOnSuccess:true,onError:reject,onProgress:(sent,total)=>this.progressNotify({operation:"upload",percent:total?Math.round(sent/total*100):0,message:"Uploading package…"}),onSuccess:()=>resolve()});upload.start();});this.progressNotify({operation:"upload",percent:100,message:"Validating package…"});const result=await this.client.functions.invoke("finalize-package-upload",{body:{path:pathName}});if(result.error)throw new Error(await this.functionError(result.error));const release=this.release(result.data as JsonRecord,this.profile.username);this.progressNotify({operation:"upload",percent:100,message:release.status==="pending_review"?"Submitted for native-code review":"Published"});return release;}
  async updateThumbnail(releaseId:string,filePath:string){if(!this.client||!this.user)throw new Error("Sign in to edit a release.");const extension=path.extname(filePath).toLowerCase();const mimeTypes:Record<string,string>={".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif"};const mimeType=mimeTypes[extension];if(!mimeType)throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");const bytes=fs.readFileSync(filePath);if(bytes.byteLength<1||bytes.byteLength>2*1024*1024)throw new Error("Thumbnail must be smaller than 2 MB.");const result=await this.client.functions.invoke("update-release-thumbnail",{body:{releaseId,mimeType,data:bytes.toString("base64")}});if(result.error)throw new Error(await this.functionError(result.error));const thumbnailPath=String((result.data as {thumbnailPath?:string}).thumbnailPath??"");return thumbnailPath?`${this.projectUrl}/storage/v1/object/public/package-thumbnails/${thumbnailPath.split("/").map(encodeURIComponent).join("/")}`:"";}
  async updateListing(releaseId:string,listing:{name?:string;description?:string;removeThumbnail?:boolean;thumbnail?:{mimeType:string;data:string}}){if(!this.client||!this.user)throw new Error("Sign in to edit a release.");const result=await this.client.functions.invoke("update-release-listing",{body:{releaseId,...listing}});if(result.error)throw new Error(await this.functionError(result.error));const response=result.data as {thumbnailRemoved?:boolean;thumbnailPath?:string};const thumbnailPath=response.thumbnailPath??"";return{...response,...(thumbnailPath?{thumbnailUrl:`${this.projectUrl}/storage/v1/object/public/package-thumbnails/${thumbnailPath.split("/").map(encodeURIComponent).join("/")}`}:{})};}
  async reportRelease(releaseId:string,reason:string){if(!this.client||!this.user)throw new Error("Sign in to report a package.");const result=await this.client.functions.invoke("report-package",{body:{releaseId,reason}});if(result.error)throw new Error(await this.functionError(result.error));}
  async setSaved(releaseId:string,saved:boolean){if(!this.client||!this.user)throw new Error("Sign in to save a package.");const result=await this.client.functions.invoke("save-package",{body:{releaseId,saved}});if(result.error)throw new Error(await this.functionError(result.error));}
  async prepareDownload(releaseId:string){if(!this.client)throw new Error("Supabase is not configured.");this.progressNotify({operation:"download",releaseId,percent:0,message:"Requesting download…"});const result=await this.client.functions.invoke("package-download",{body:{releaseId}});if(result.error)throw new Error(await this.functionError(result.error));const body=result.data as {url:string;sha256:string;byteSize:number;manifest:CustomMappingPackageManifest};const response=await fetch(body.url);if(!response.ok)throw new Error(`Package download failed (${response.status}).`);if(!response.body)throw new Error("Package download returned no data.");const reader=response.body.getReader();const chunks:Buffer[]=[];let received=0;while(true){const{done,value}=await reader.read();if(done)break;const chunk=Buffer.from(value);chunks.push(chunk);received+=chunk.byteLength;this.progressNotify({operation:"download",releaseId,percent:Math.min(88,Math.round(received/Math.max(1,body.byteSize)*88)),message:"Downloading package…"});}const bytes=Buffer.concat(chunks);this.progressNotify({operation:"download",releaseId,percent:90,message:"Verifying package…"});if(bytes.byteLength!==body.byteSize||crypto.createHash("sha256").update(bytes).digest("hex")!==body.sha256)throw new Error("Downloaded package failed its integrity check.");const temporary=path.join(this.local.packagesRoot,`.download-${crypto.randomUUID()}.surreality`);fs.writeFileSync(temporary,bytes,{flag:"wx"});return{temporary,bytes,manifest:body.manifest,sha256:body.sha256};}
  completeDownload(releaseId:string,bytes:Buffer,manifest:CustomMappingPackageManifest){this.local.archivePackageBuffer(bytes,`${manifest.id}-${manifest.version}.surreality`,manifest as unknown as JsonRecord,"community",releaseId);this.progressNotify({operation:"download",releaseId,percent:100,message:"Installed"});}
  async moderate(releaseId:string,action:"approve"|"reject"|"take_down"|"restore",reason?:string){if(!this.client||!this.user)throw new Error("Sign in to manage releases.");const result=await this.client.functions.invoke("moderate-package",{body:{releaseId,action,reason}});if(result.error)throw new Error(await this.functionError(result.error));}
  private async functionError(error:{context?:unknown;message:string}){
    const response=error.context as Response|undefined;
    if(!response||typeof response.clone!=="function")return error.message;
    try{
      const body=await response.clone().json() as {error?:unknown;message?:unknown};
      const message=typeof body.error==="string"?body.error:typeof body.message==="string"?body.message:"";
      if(message)return message;
    }catch{/* Try the response as text below. */}
    try{
      const text=(await response.clone().text()).trim().replace(/\s+/g," ");
      if(text&&!/^<!doctype|^<html/i.test(text))return text.slice(0,300);
    }catch{/* Fall back to the status-aware message below. */}
    if(response.status===404)return "This community feature has not been deployed to the configured Supabase project yet.";
    if(response.status===401)return "Your session expired. Sign in again.";
    if(response.status===403)return "You do not have permission to perform this action.";
    return `${error.message} (${response.status})`;
  }
}
