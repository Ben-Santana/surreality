import { useSyncExternalStore } from "react";
import type { CloudState } from "./types";

const EMPTY_STATE: CloudState = { configured: false, user: null, profile: null, lastError: null };
let state = EMPTY_STATE;
let authDialogOpen = false;
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;
function emit(){for(const listener of listeners)listener();}
function setState(next:CloudState|undefined){if(!next)return;state=next;emit();}

export async function initializeCloud(){if(!window.room||stopListening)return;stopListening=window.room.cloud.onState(setState);const url=import.meta.env.VITE_SUPABASE_URL?.trim()??"";const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()??"";setState(url&&key?await window.room.cloud.configure(url,key):await window.room.cloud.getState());}
export function disposeCloud(){stopListening?.();stopListening=undefined;}
export function useCloudState(){return useSyncExternalStore((listener)=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);}
export function useAuthDialogOpen(){return useSyncExternalStore((listener)=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>authDialogOpen);}
export function showAuthDialog(){authDialogOpen=true;emit();} export function hideAuthDialog(){authDialogOpen=false;emit();}
export async function signIn(email:string,password:string){if(!window.room)throw new Error("Desktop integration is unavailable.");setState(await window.room.cloud.signIn(email,password));}
export async function signUp(email:string,password:string){if(!window.room)throw new Error("Desktop integration is unavailable.");const result=await window.room.cloud.signUp(email,password);setState(result.state);return result;}
export async function signOut(){if(!window.room)return;setState(await window.room.cloud.signOut());}
export async function sendPasswordReset(email:string){await window.room?.cloud.sendPasswordReset(email);}
export async function recoverPassword(email:string,token:string,newPassword:string){if(!window.room)return;setState(await window.room.cloud.recoverPassword(email,token,newPassword));}
export async function setUsername(username:string){if(!window.room)throw new Error("Desktop integration is unavailable.");setState(await window.room.community.setUsername(username));}
