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
function timeZone(){try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(!z)return '';new Intl.DateTimeFormat('pt-BR',{timeZone:z}).format();return z}catch{return ''}}
module.exports={interfaces,port,defaultUrl,timeZone,kindOf};
