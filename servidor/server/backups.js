'use strict';
const fs=require('fs'),fsp=fs.promises,path=require('path'),os=require('os'),crypto=require('crypto');
const {backup,DatabaseSync}=require('node:sqlite');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
const clock=(now,tz)=>new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
function contains(parent,child){const rel=path.relative(path.resolve(parent),path.resolve(child));return !rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
module.exports=function(store,{application=__dirname,documents=process.env.GZ_DOCUMENTS_DIR||path.join(os.homedir(),'Documents'),serialize=fn=>fn(),pack=async(stage,file)=>execute(path.join(application,'BackupTool.exe'),['pack',stage,file],{windowsHide:true,maxBuffer:1024*1024}),now=()=>Date.now()}={}){
 /* 1.2.3: pasta Documentos\gamezoney\backup (antes Documentos\bkp gamezoney). Automáticos: só os dos últimos 7 dias. Manuais: nunca apagados. */
 const oldDirectory=path.join(documents,'bkp gamezoney'),defaultDirectory=path.join(documents,'gamezoney','backup');
 store.state.settings.backup??={enabled:true,time:'03:00',directory:defaultDirectory};
 const KEEP_DAYS=7,AUTO=/^GameZoney-auto-.*\.zip$/i;
 /* backups antigos (nome sem auto/manual): automáticos = os que o Log registrou como feitos pelo sistema; o resto conta como manual (nunca apagado) */
 const legacyAuto=()=>{const set=new Set();try{for(const r of store.db.prepare("SELECT detail FROM logs WHERE actor='sistema' AND type='backup' AND detail LIKE 'Backup completo criado: %'").all())set.add(path.basename(r.detail.slice('Backup completo criado: '.length)).toLowerCase());}catch{}return set;};
 const isAuto=(name,legacy)=>AUTO.test(name)||(/^GameZoney-\d{4}-.*\.zip$/i.test(name)&&legacy.has(name.toLowerCase()));
 function migrateFolder(){const b=store.state.settings.backup;if(b.folderV2)return;
  if(path.resolve(b.directory||'')===path.resolve(oldDirectory))b.directory=defaultDirectory;
  let moved=0,failed=0;
  try{if(fs.existsSync(oldDirectory)){fs.mkdirSync(defaultDirectory,{recursive:true});for(const entry of fs.readdirSync(oldDirectory,{withFileTypes:true})){const from=path.join(oldDirectory,entry.name);let to=path.join(defaultDirectory,entry.name);if(fs.existsSync(to))to=path.join(defaultDirectory,path.parse(entry.name).name+'-'+crypto.randomBytes(2).toString('hex')+path.parse(entry.name).ext);try{fs.renameSync(from,to);moved++;}catch{failed++;}}
   if(!failed){try{fs.rmdirSync(oldDirectory);}catch{}}}}catch{failed++;}
  if(!failed)b.folderV2=Date.now();
  if(moved||failed)store.log('sistema','backup',failed?`Backups: ${moved} movidos para ${defaultDirectory}; ${failed} ficaram em ${oldDirectory} (em uso?) e serão movidos na próxima abertura.`:`Backups movidos de ${oldDirectory} para ${defaultDirectory} (${moved}).`);
 }
 try{migrateFolder();}catch{}
 store.persist();
 /* depois de um backup automático que deu certo: apaga só os AUTOMÁTICOS com mais de 7 dias (nunca o que acabou de ser feito, nunca os manuais) */
 async function prune(dir,keepFile,at){const legacy=legacyAuto(),limit=at-KEEP_DAYS*86400000,removed=[];
  for(const entry of await fsp.readdir(dir,{withFileTypes:true})){if(!entry.isFile()||!isAuto(entry.name,legacy))continue;const file=path.join(dir,entry.name);if(path.resolve(file)===path.resolve(keepFile))continue;
   const m=entry.name.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);const t=m?Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`):(await fsp.stat(file)).mtimeMs;
   if(t<limit){try{await fsp.rm(file,{force:true});removed.push(entry.name);}catch{}}}
  if(removed.length)store.log('sistema','backup',`Backups automáticos com mais de ${KEEP_DAYS} dias apagados: ${removed.length} (os manuais nunca são apagados).`);
  return removed;}
 let running=null,lastAttempt=0,progress='';
 const status=()=>({...store.state.settings.backup,defaultDirectory,running:!!running,progress});
 function configure(input,actor){if(typeof input.enabled!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))throw Error('Informe um horário válido.');const directory=String(input.directory||defaultDirectory).trim();if(!path.isAbsolute(directory)||contains(store.directory,directory)||contains(application,directory))throw Error('Escolha uma pasta absoluta fora das pastas do programa e de dados.');store.change(actor,'config','Backup diário configurado',()=>Object.assign(store.state.settings.backup,{enabled:input.enabled,time:input.time,directory}));return status();}
 async function copyTree(source,target,skip=()=>false,relative=''){await fsp.mkdir(target,{recursive:true});for(const entry of await fsp.readdir(source,{withFileTypes:true})){const rel=path.join(relative,entry.name);if(skip(rel))continue;if(entry.isSymbolicLink())throw Error('Não é possível incluir um atalho de pasta no backup: '+rel);if(entry.isDirectory())await copyTree(path.join(source,entry.name),path.join(target,entry.name),skip,rel);else if(entry.isFile())await fsp.copyFile(path.join(source,entry.name),path.join(target,entry.name));}}
 async function inventory(dir,prefix='',files=[]){for(const entry of await fsp.readdir(dir,{withFileTypes:true})){const name=prefix+entry.name,file=path.join(dir,entry.name);if(entry.isDirectory())await inventory(file,name+'/',files);else{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);files.push({path:name,bytes:(await fsp.stat(file)).size,sha256:hash.digest('hex')});}}return files;}
 async function run(actor,kind){const setting=store.state.settings.backup,stamp=now(),dir=path.resolve(setting.directory),name='GameZoney-'+kind+'-'+new Date(stamp).toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'),stage=path.join(dir,'.'+name+'.partial'),file=path.join(dir,name+'.zip'),partial=file+'.partial';lastAttempt=stamp;
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
   if(kind==='auto')await prune(dir,file,stamp).catch(()=>{});
   return {file,bytes};
  }catch(error){await serialize(()=>{store.state.settings.backup.lastError=error.message;store.persist();store.log(actor,'erro','Falha no backup completo: '+error.message);});throw error;}
  finally{progress='';if(contains(dir,stage)&&path.dirname(stage)===dir)await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});await fsp.rm(partial,{force:true}).catch(()=>{});}
 }
 function start(actor='sistema',kind=actor==='sistema'?'auto':'manual'){if(running)return status();running=run(actor,kind).finally(()=>{running=null;});running.catch(()=>{});return status();}
 function due(at=now()){const s=store.state.settings.backup,local=clock(at,store.state.settings.timeZone);return s.enabled&&!running&&at-lastAttempt>=15*60000&&s.lastDay!==local.slice(0,10)&&(!s.lastSuccess||local.slice(11,16)>=s.time);}
 return{status,configure,start,prune,KEEP_DAYS,tick:()=>{if(due())start('sistema','auto');},due,wait:()=>running||Promise.resolve()};
};
