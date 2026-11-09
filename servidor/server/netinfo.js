'use strict';
// 1.0.5: rede e fuso da máquina onde o servidor está instalado (padrão de "Endereço do servidor" e "Fuso horário").
const os=require('node:os');
const VIRTUAL=/vethernet|virtual|vmware|vbox|hyper-v|docker|wsl|loopback|bluetooth|tailscale|zerotier|hamachi|radmin|vpn|npcap|\btap\b|\btun\b|^veth|^br-|^virbr/i;
const WIFI=/wi-?fi|wireless|wlan|sem fio|802\.11|^wl/i;
const RANK={cabo:0,wifi:1,virtual:2};
function kindOf(name){if(VIRTUAL.test(name))return 'virtual';if(WIFI.test(name))return 'wifi';return 'cabo'}
function interfaces(){const out=[];for(const [name,list] of Object.entries(os.networkInterfaces()))for(const a of list||[])if((a.family==='IPv4'||a.family===4)&&!a.internal&&!a.address.startsWith('169.254.'))out.push({name,address:a.address,kind:kindOf(name)});return out.sort((a,b)=>RANK[a.kind]-RANK[b.kind])}
function port(){const p=Number(process.env.PORT||3000);return Number.isInteger(p)&&p>0&&p<65536?p:3000}
function defaultUrl(){const ip=interfaces()[0]?.address;return ip?`http://${ip}:${port()}`:''}
/* 1.0.5: data e hora = as do computador onde o servidor está instalado (inclusive UTC); o fuso só é usado internamente para isso. */
/* 1.2.5: fuso = o do computador do servidor. Se o Windows usa um fuso que o sistema não reconhece, ou o relógio foi
   ajustado à mão e não bate com o fuso (ex.: horário de verão desligado), vale o HORÁRIO QUE O COMPUTADOR ESTÁ MOSTRANDO:
   fuso fixo com a diferença atual do relógio da máquina para o UTC (antes caía em America/Manaus). */
const valid=z=>{try{new Intl.DateTimeFormat('pt-BR',{timeZone:z}).format();return true}catch{return false}};
function zoneOffset(z,d=new Date()){const t=typeof d==='number'?d:d.getTime(),p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(t/60000)*60000)/60000);}
function machineZone(d=new Date()){const off=-d.getTimezoneOffset();if(off===0)return 'UTC';if(off%60===0){const h=off/60,z='Etc/GMT'+(h>0?'-':'+')+Math.abs(h);if(valid(z))return z;}const a=Math.abs(off),z=(off>0?'+':'-')+String(Math.floor(a/60)).padStart(2,'0')+':'+String(a%60).padStart(2,'0');return valid(z)?z:'UTC';}
/* 1.2.7: fusos por país. Quando o fuso do Windows não serve, o país da instalação (região/idioma do Windows) escolhe o fuso
   com o NOME certo que bate com o relógio do computador. Brasil: Noronha UTC−2, Brasília UTC−3, Amazonas UTC−4, Acre UTC−5.
   Ordem = preferência quando dois fusos do país têm a mesma diferença. */
const COUNTRY_ZONES={
 BR:['America/Sao_Paulo','America/Noronha','America/Manaus','America/Rio_Branco','America/Bahia','America/Fortaleza','America/Recife','America/Belem','America/Cuiaba','America/Campo_Grande','America/Porto_Velho','America/Boa_Vista','America/Eirunepe'],
 AR:['America/Argentina/Buenos_Aires','America/Argentina/Cordoba','America/Argentina/Mendoza'],BO:['America/La_Paz'],PE:['America/Lima'],UY:['America/Montevideo'],PY:['America/Asuncion'],VE:['America/Caracas'],
 CL:['America/Santiago','America/Punta_Arenas','Pacific/Easter'],CO:['America/Bogota'],EC:['America/Guayaquil','Pacific/Galapagos'],GY:['America/Guyana'],SR:['America/Paramaribo'],GF:['America/Cayenne'],
 MX:['America/Mexico_City','America/Cancun','America/Monterrey','America/Chihuahua','America/Hermosillo','America/Mazatlan','America/Tijuana'],
 US:['America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'],
 CA:['America/Toronto','America/Winnipeg','America/Edmonton','America/Vancouver','America/Halifax','America/St_Johns','America/Regina'],
 GT:['America/Guatemala'],SV:['America/El_Salvador'],HN:['America/Tegucigalpa'],NI:['America/Managua'],CR:['America/Costa_Rica'],PA:['America/Panama'],
 CU:['America/Havana'],DO:['America/Santo_Domingo'],PR:['America/Puerto_Rico'],JM:['America/Jamaica'],HT:['America/Port-au-Prince'],
 PT:['Europe/Lisbon','Atlantic/Azores','Atlantic/Madeira'],ES:['Europe/Madrid','Atlantic/Canary'],GB:['Europe/London'],IE:['Europe/Dublin'],FR:['Europe/Paris'],DE:['Europe/Berlin'],IT:['Europe/Rome'],
 AO:['Africa/Luanda'],MZ:['Africa/Maputo'],CV:['Atlantic/Cape_Verde'],JP:['Asia/Tokyo'],
};
const LANGUAGE_COUNTRY={pt:'BR'};// idioma sem região: português = Brasil
let countryCache;
/* país da instalação: região do Windows (Geo) > idioma/região do Windows > do Node > LANG */
function country(){
 if(countryCache!==undefined)return countryCache;
 const pick=v=>{const m=String(v||'').match(/^[a-z]{2,3}[-_]([A-Za-z]{2})\b/i)||String(v||'').match(/^([A-Za-z]{2})$/);return m?m[1].toUpperCase():''};
 let cc='';
 if(process.platform==='win32'){try{const {execFileSync}=require('node:child_process');const q=k=>execFileSync('reg.exe',['query',k[0],'/v',k[1]],{encoding:'utf8',timeout:3000,windowsHide:true}).match(/REG_SZ\s+(\S+)/)?.[1]||'';cc=pick(q(['HKCU\\Control Panel\\International\\Geo','Name']))||pick(q(['HKCU\\Control Panel\\International','LocaleName']));}catch{}}
 if(!cc){try{cc=pick(Intl.DateTimeFormat().resolvedOptions().locale)}catch{}}
 if(!cc)cc=pick(process.env.LC_ALL||process.env.LANG||'');
 if(!cc){try{const l=Intl.DateTimeFormat().resolvedOptions().locale.slice(0,2).toLowerCase();cc=LANGUAGE_COUNTRY[l]||''}catch{}}
 return countryCache=cc;
}
function countryZone(cc,d=new Date()){const off=-d.getTimezoneOffset();for(const z of COUNTRY_ZONES[cc]||[]){try{if(valid(z)&&zoneOffset(z,d)===off)return z}catch{}}return '';}
function timeZone(d=new Date(),cc){try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&!/unknown/i.test(z)&&valid(z)&&zoneOffset(z,d)===-d.getTimezoneOffset())return z;}catch{}
 return countryZone(cc===undefined?country():cc,d)||machineZone(d);}
module.exports={interfaces,port,defaultUrl,timeZone,machineZone,zoneOffset,country,countryZone,COUNTRY_ZONES,kindOf};
