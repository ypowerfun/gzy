'use strict';
const fs=require('fs'),fsp=fs.promises,path=require('path'),os=require('os'),crypto=require('crypto');
const {backup,DatabaseSync}=require('node:sqlite');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
const clock=(now,tz)=>new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
function contains(parent,child){const rel=path.relative(path.resolve(parent),path.resolve(child));return !rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
module.exports=function(store,{application=__dirname,documents=process.env.GZ_DOCUMENTS_DIR||path.join(os.homedir(),'Documents'),serialize=fn=>fn(),pack=async(stage,file)=>execute(path.join(application,'BackupTool.exe'),['pack',stage,file],{windowsHide:true,maxBuffer:1024*1024}),now=()=>Date.now()}={}){
 const defaultDirectory=path.join(documents,'bkp gamezoney');
 store.state.settings.backup??={enabled:true,time:'03:00',directory:defaultDirectory};store.persist();
 let running=null,lastAttempt=0,progress='';
 const status=()=>({...store.state.settings.backup,defaultDirectory,running:!!running,progress});
 function configure(input,actor){if(typeof input.enabled!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))throw Error('Informe um horário válido.');const directory=String(input.directory||defaultDirectory).trim();if(!path.isAbsolute(directory)||contains(store.directory,directory)||contains(application,directory))throw Error('Escolha uma pasta absoluta fora das pastas do programa e de dados.');store.change(actor,'config','Backup diário configurado',()=>Object.assign(store.state.settings.backup,{enabled:input.enabled,time:input.time,directory}));return status();}
 async function copyTree(source,target,skip=()=>false,relative=''){await fsp.mkdir(target,{recursive:true});for(const entry of await fsp.readdir(source,{withFileTypes:true})){const rel=path.join(relative,entry.name);if(skip(rel))continue;if(entry.isSymbolicLink())throw Error('Não é possível incluir um atalho de pasta no backup: '+rel);if(entry.isDirectory())await copyTree(path.join(source,entry.name),path.join(target,entry.name),skip,rel);else if(entry.isFile())await fsp.copyFile(path.join(source,entry.name),path.join(target,entry.name));}}
 async function inventory(dir,prefix='',files=[]){for(const entry of await fsp.readdir(dir,{withFileTypes:true})){const name=prefix+entry.name,file=path.join(dir,entry.name);if(entry.isDirectory())await inventory(file,name+'/',files);else{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);files.push({path:name,bytes:(await fsp.stat(file)).size,sha256:hash.digest('hex')});}}return files;}
 async function run(actor){const setting=store.state.settings.backup,stamp=now(),dir=path.resolve(setting.directory),name='GameZoney-'+new Date(stamp).toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'),stage=path.join(dir,'.'+name+'.partial'),file=path.join(dir,name+'.zip'),partial=file+'.partial';lastAttempt=stamp;
  try{
   if(contains(application,dir)||contains(store.directory,dir))throw Error('Destino de backup inválido.');
   progress='Copiando os dados e pareamentos';await fsp.mkdir(stage,{recursive:true});
   await serialize(async()=>{const data=path.join(stage,'dados');await copyTree(store.directory,data,rel=>['backups','gamezoney.sqlite','gamezoney.sqlite-wal','gamezoney.sqlite-shm'].includes(rel.split(path.sep)[0]));await backup(store.db,path.join(data,'gamezoney.sqlite'));const check=new DatabaseSync(path.join(data,'gamezoney.sqlite'),{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('A cópia do banco não passou na verificação.');}finally{check.close();}});
   progress='Incluindo o programa do servidor';await copyTree(application,path.join(stage,'servidor'),rel=>['data','backups','.git','test'].includes(rel.split(path.sep)[0]));
   const manifest={format:'gamezoney-full-backup',schema:1,createdAt:stamp,version:require('./package.json').version,files:await inventory(stage)};
   await fsp.writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2));
   await fsp.writeFile(path.join(stage,'COMO-RESTAURAR.txt'),'BACKUP COMPLETO GameZoney\r\nInstale o servidor no computador de destino. Com o servidor fechado, abra Restaurar backup GameZoney pelo menu Iniciar e selecione este ZIP. A restauração valida os arquivos e guarda os dados atuais em uma pasta anterior. O ZIP contém dados, usuários, senhas protegidas, saldos, histórico, imagens, pareamentos, identidade HTTPS e uma cópia do programa. Não compartilhe publicamente.\r\nSe o IP mudar, atualize o endereço do servidor para as TVs. A descoberta dos PCs utiliza a identidade restaurada. Sessões refletem o horário em que esta cópia foi feita.\r\n');
   progress='Compactando e verificando o arquivo';await pack(stage,partial);await fsp.rename(partial,file);
   const bytes=(await fsp.stat(file)).size;await serialize(()=>{Object.assign(store.state.settings.backup,{lastSuccess:stamp,lastFile:file,lastBytes:bytes,lastDay:clock(stamp,store.state.settings.timeZone).slice(0,10),lastError:''});store.persist();store.log(actor,'backup','Backup completo criado: '+file);});
   return {file,bytes};
  }catch(error){await serialize(()=>{store.state.settings.backup.lastError=error.message;store.persist();store.log(actor,'erro','Falha no backup completo: '+error.message);});throw error;}
  finally{progress='';if(contains(dir,stage)&&path.dirname(stage)===dir)await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});await fsp.rm(partial,{force:true}).catch(()=>{});}
 }
 function start(actor='sistema'){if(running)return status();running=run(actor).finally(()=>{running=null;});running.catch(()=>{});return status();}
 function due(at=now()){const s=store.state.settings.backup,local=clock(at,store.state.settings.timeZone);return s.enabled&&!running&&at-lastAttempt>=15*60000&&s.lastDay!==local.slice(0,10)&&(!s.lastSuccess||local.slice(11,16)>=s.time);}
 return{status,configure,start,tick:()=>{if(due())start();},due,wait:()=>running||Promise.resolve()};
};
