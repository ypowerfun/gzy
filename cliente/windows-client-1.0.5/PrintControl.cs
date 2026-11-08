// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.0.7: placas de rede do PC (para o Servidor ligar o PC pela rede — Wake-on-LAN) e controle de impressão.
// Controle de impressão (ligado em Configuração › Controle de impressão no Servidor): durante a sessão do cliente, todo
// documento enviado para qualquer impressora deste PC é PAUSADO na fila do Windows assim que aparece (aviso imediato do
// spooler + conferência a cada 400 ms). O Servidor recebe a lista; a recepção aprova (o documento continua e imprime) ou
// recusa (o documento é apagado da fila). Em modo administrador nada é pausado. Desligar o controle libera os pausados.
using System;
using System.Collections.Generic;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;

public static class PcNetwork {
 // placas físicas (cabo e Wi-Fi) com MAC, IP e máscara; adaptadores virtuais/VPN ficam de fora
 public static object[] Adapters(){
  var list=new List<object>();
  try{
   foreach(var n in NetworkInterface.GetAllNetworkInterfaces()){
    var type=n.NetworkInterfaceType;bool wired=type==NetworkInterfaceType.Ethernet||type==NetworkInterfaceType.GigabitEthernet||type==NetworkInterfaceType.FastEthernetT||type==NetworkInterfaceType.FastEthernetFx;
    if(!wired&&type!=NetworkInterfaceType.Wireless80211)continue;
    string desc=((n.Description??"")+" "+(n.Name??"")).ToLowerInvariant();
    if(desc.Contains("virtual")||desc.Contains("vmware")||desc.Contains("hyper-v")||desc.Contains("vpn")||desc.Contains("loopback")||desc.Contains("bluetooth")||desc.Contains("tap-")||desc.Contains("wan miniport"))continue;
    string mac=n.GetPhysicalAddress().ToString();if(mac.Length!=12)continue;
    bool up=n.OperationalStatus==OperationalStatus.Up;if(!up&&!wired)continue;
    string ip="",mask="";
    if(up)foreach(var u in n.GetIPProperties().UnicastAddresses){if(u.Address.AddressFamily==AddressFamily.InterNetwork){ip=u.Address.ToString();try{mask=u.IPv4Mask==null?"":u.IPv4Mask.ToString();}catch{}break;}}
    list.Add(new {mac=mac,ip=ip,mask=mask,name=n.Name,wired=wired,up=up});
   }
  }catch{}
  return list.ToArray();
 }
}

public class PrintControl {
 [StructLayout(LayoutKind.Sequential)] struct SYSTEMTIME{public ushort wYear,wMonth,wDayOfWeek,wDay,wHour,wMinute,wSecond,wMilliseconds;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct JOB_INFO_1{public uint JobId;public string pPrinterName,pMachineName,pUserName,pDocument,pDatatype,pStatus;public uint Status,Priority,Position,TotalPages,PagesPrinted;public SYSTEMTIME Submitted;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct PRINTER_INFO_4{public string pPrinterName,pServerName;public uint Attributes;}
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool EnumJobs(IntPtr handle,uint first,uint count,uint level,IntPtr buffer,uint size,out uint needed,out uint returned);
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetJob(IntPtr handle,uint jobId,uint level,IntPtr job,uint command);
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool EnumPrinters(uint flags,string name,uint level,IntPtr buffer,uint size,out uint needed,out uint returned);
 [DllImport("winspool.drv",SetLastError=true)] static extern IntPtr FindFirstPrinterChangeNotification(IntPtr handle,uint filter,uint options,IntPtr notifyOptions);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool FindNextPrinterChangeNotification(IntPtr change,out uint what,IntPtr options,IntPtr info);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool FindClosePrinterChangeNotification(IntPtr change);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 const uint PAUSE=1,RESUME=2,DELETE=5;
 const uint ST_PAUSED=0x1,ST_DELETING=0x4,ST_SPOOLING=0x8,ST_PRINTING=0x10,ST_PRINTED=0x80,ST_DELETED=0x100,ST_COMPLETE=0x1000;
 const uint ENUM_LOCAL=2,ENUM_CONNECTIONS=4,CHANGE_JOB=0x0000FF00;
 static readonly IntPtr INVALID=new IntPtr(-1);

 class Held{public string id,printer,document;public uint jobId;public int pages;public bool spooling;}
 readonly object sync=new object();
 readonly Dictionary<string,Held> held=new Dictionary<string,Held>();
 readonly HashSet<string> released=new HashSet<string>();
 volatile bool enabled,active;Thread thread;volatile bool stop;
 public string LastError="";

 // enabled = controle ligado no Servidor; active = há sessão de cliente neste PC (fora do modo administrador)
 public void Update(bool enabled,bool active){this.enabled=enabled;this.active=enabled&&active;if(enabled)Start();}
 public void Start(){if(thread!=null)return;thread=new Thread(Loop){IsBackground=true,Name="GameZoney.Print"};thread.Start();}
 public void Stop(){stop=true;}

 void Loop(){
  IntPtr server=IntPtr.Zero,change=INVALID;
  try{if(OpenPrinter(null,out server,IntPtr.Zero))change=FindFirstPrinterChangeNotification(server,CHANGE_JOB,0,IntPtr.Zero);}catch{}
  while(!stop){
   try{
    if(change!=INVALID&&change!=IntPtr.Zero){if(WaitForSingleObject(change,400)==0){uint what;FindNextPrinterChangeNotification(change,out what,IntPtr.Zero,IntPtr.Zero);}}
    else Thread.Sleep(400);
    Scan();
   }catch(Exception e){LastError=e.Message;Thread.Sleep(1000);}
  }
  try{if(change!=INVALID&&change!=IntPtr.Zero)FindClosePrinterChangeNotification(change);if(server!=IntPtr.Zero)ClosePrinter(server);}catch{}
 }

 static List<string> Printers(){
  var names=new List<string>();uint needed,count;
  EnumPrinters(ENUM_LOCAL|ENUM_CONNECTIONS,null,4,IntPtr.Zero,0,out needed,out count);if(needed==0)return names;
  IntPtr buf=Marshal.AllocHGlobal((int)needed);
  try{if(EnumPrinters(ENUM_LOCAL|ENUM_CONNECTIONS,null,4,buf,needed,out needed,out count)){int size=Marshal.SizeOf(typeof(PRINTER_INFO_4));for(int i=0;i<count;i++){var p=(PRINTER_INFO_4)Marshal.PtrToStructure(new IntPtr(buf.ToInt64()+i*size),typeof(PRINTER_INFO_4));if(!String.IsNullOrEmpty(p.pPrinterName))names.Add(p.pPrinterName);}}}
  finally{Marshal.FreeHGlobal(buf);}
  return names;
 }
 static List<JOB_INFO_1> Jobs(IntPtr printer){
  var jobs=new List<JOB_INFO_1>();uint needed,count;
  EnumJobs(printer,0,255,1,IntPtr.Zero,0,out needed,out count);if(needed==0)return jobs;
  IntPtr buf=Marshal.AllocHGlobal((int)needed);
  try{if(EnumJobs(printer,0,255,1,buf,needed,out needed,out count)){int size=Marshal.SizeOf(typeof(JOB_INFO_1));for(int i=0;i<count;i++)jobs.Add((JOB_INFO_1)Marshal.PtrToStructure(new IntPtr(buf.ToInt64()+i*size),typeof(JOB_INFO_1)));}}
  finally{Marshal.FreeHGlobal(buf);}
  return jobs;
 }
 static string Key(string printer,JOB_INFO_1 j){var t=j.Submitted;return printer+"|"+j.JobId+"|"+t.wYear+t.wMonth.ToString("00")+t.wDay.ToString("00")+t.wHour.ToString("00")+t.wMinute.ToString("00")+t.wSecond.ToString("00")+t.wMilliseconds.ToString("000");}

 void Scan(){
  var seen=new HashSet<string>();
  foreach(var name in Printers()){
   IntPtr h;if(!OpenPrinter(name,out h,IntPtr.Zero))continue;
   try{
    foreach(var j in Jobs(h)){
     string key=Key(name,j);seen.Add(key);
     lock(sync){
      if(released.Contains(key))continue;
      Held x;
      if(held.TryGetValue(key,out x)){
       x.pages=(int)Math.Max(x.pages,(int)j.TotalPages);x.spooling=(j.Status&ST_SPOOLING)!=0;
       if(!enabled){SetJob(h,j.JobId,0,IntPtr.Zero,RESUME);held.Remove(key);released.Add(key);}
       else if((j.Status&ST_PAUSED)==0&&(j.Status&(ST_PRINTING|ST_PRINTED|ST_DELETING|ST_DELETED|ST_COMPLETE))==0)SetJob(h,j.JobId,0,IntPtr.Zero,PAUSE);
       continue;
      }
      if(!active||(j.Status&(ST_PRINTED|ST_DELETING|ST_DELETED|ST_COMPLETE))!=0)continue;
      if(SetJob(h,j.JobId,0,IntPtr.Zero,PAUSE))held[key]=new Held{id=key,printer=name,document=String.IsNullOrEmpty(j.pDocument)?"Documento":j.pDocument,jobId=j.JobId,pages=(int)j.TotalPages,spooling=(j.Status&ST_SPOOLING)!=0};
      else LastError="Não foi possível pausar a impressão ("+Marshal.GetLastWin32Error()+").";
     }
    }
   }finally{ClosePrinter(h);}
  }
  lock(sync){
   var gone=new List<string>();foreach(var k in held.Keys)if(!seen.Contains(k))gone.Add(k);foreach(var k in gone)held.Remove(k);
   released.RemoveWhere(k=>!seen.Contains(k));
  }
 }

 // lista enviada ao Servidor (documentos pausados aguardando a recepção)
 public object[] Report(){lock(sync){var list=new List<object>();foreach(var x in held.Values)list.Add(new {id=x.id,printer=x.printer,document=x.document,pages=x.pages,copies=1,spooling=x.spooling});return list.ToArray();}}

 // decisões da recepção: approve = continua e imprime; reject = apaga da fila
 public void Apply(System.Collections.IEnumerable decisions){
  if(decisions==null)return;
  foreach(var item in decisions){
   var d=item as Dictionary<string,object>;if(d==null||!d.ContainsKey("id"))continue;
   string id=Convert.ToString(d["id"]),action=d.ContainsKey("action")?Convert.ToString(d["action"]):"";
   Held x;lock(sync){if(!held.TryGetValue(id,out x))continue;}
   IntPtr h;if(!OpenPrinter(x.printer,out h,IntPtr.Zero))continue;
   try{
    bool ok=SetJob(h,x.jobId,0,IntPtr.Zero,action=="approve"?RESUME:DELETE);
    if(ok)lock(sync){held.Remove(id);if(action=="approve")released.Add(id);}
    else LastError="Falha ao "+(action=="approve"?"liberar":"apagar")+" a impressão ("+Marshal.GetLastWin32Error()+").";
   }finally{ClosePrinter(h);}
  }
 }
}
