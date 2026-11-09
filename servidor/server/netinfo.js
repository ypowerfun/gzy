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
function zoneOffset(z,d=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(d.getTime()/60000)*60000)/60000);}
function machineZone(d=new Date()){const off=-d.getTimezoneOffset();if(off===0)return 'UTC';if(off%60===0){const h=off/60,z='Etc/GMT'+(h>0?'-':'+')+Math.abs(h);if(valid(z))return z;}const a=Math.abs(off),z=(off>0?'+':'-')+String(Math.floor(a/60)).padStart(2,'0')+':'+String(a%60).padStart(2,'0');return valid(z)?z:'UTC';}
function timeZone(d=new Date()){try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&!/unknown/i.test(z)&&valid(z)&&zoneOffset(z,d)===-d.getTimezoneOffset())return z;}catch{}return machineZone(d);}
module.exports={interfaces,port,defaultUrl,timeZone,machineZone,zoneOffset,kindOf};
