using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Web.Script.Serialization;
[assembly: System.Reflection.AssemblyTitle("GameZoney BackupTool")]
[assembly: System.Reflection.AssemblyCompany("GameZoney")]
[assembly: System.Reflection.AssemblyProduct("GameZoney")]
[assembly: System.Reflection.AssemblyDescription("GameZoney - backup completo")]
[assembly: System.Reflection.AssemblyCopyright("© 2026 GameZoney. Todos os direitos reservados.")]
[assembly: System.Reflection.AssemblyTrademark("GameZoney")]
class BackupFile { public string path; public long bytes; public string sha256; }
class BackupManifest { public string format; public int schema; public BackupFile[] files; }
class BackupTool {
 static string LongPath(string value){string full=Path.GetFullPath(value);return full.StartsWith(@"\\?\")?full:full.StartsWith(@"\\")?@"\\?\UNC\"+full.Substring(2):@"\\?\"+full;}

 static string Hash(Stream stream){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();}
 static string Safe(string root,string relative){if(String.IsNullOrEmpty(relative)||relative.Contains(":")||relative.Contains("\\"))throw new Exception("Caminho inválido no backup.");foreach(var part in relative.Split('/'))if(part=="."||part==".."||part==""||part.EndsWith(" ")||part.EndsWith("."))throw new Exception("Caminho inválido no backup.");string path=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));if(!path.StartsWith(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Caminho fora da pasta de restauração.");return path;}
 static void Validate(ZipArchive zip,BackupManifest manifest){if(manifest==null||(manifest.format!="gamezoney-full-backup"&&manifest.format!="gz-arena-full-backup")||manifest.schema!=1||manifest.files==null)throw new Exception("Não é um backup completo do GameZoney.");var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);bool database=false;foreach(var file in manifest.files){Safe(Path.GetTempPath(),file.path);if(!seen.Add(file.path))throw new Exception("Arquivo duplicado no backup.");var entry=zip.GetEntry(file.path);if(entry==null||entry.Length!=file.bytes)throw new Exception("Arquivo ausente ou incompleto: "+file.path);using(var stream=entry.Open())if(Hash(stream)!=file.sha256)throw new Exception("Arquivo corrompido: "+file.path);if(file.path=="dados/gamezoney.sqlite"||file.path=="dados/prime-arena.sqlite")database=true;}if(!database)throw new Exception("Banco de dados ausente.");}
 static BackupManifest Manifest(ZipArchive zip){var entry=zip.GetEntry("manifest.json");if(entry==null||entry.Length>16*1024*1024)throw new Exception("Manifesto do backup inválido.");using(var reader=new StreamReader(entry.Open()))return new JavaScriptSerializer{MaxJsonLength=16*1024*1024}.Deserialize<BackupManifest>(reader.ReadToEnd());}
 // Aceita também backups completos de versões anteriores (formato e nome de banco antigos: o banco vira gamezoney.sqlite).
 static void Restore(string file,string target){target=Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar);string parent=Path.GetDirectoryName(target);if(String.IsNullOrEmpty(parent)||target==Path.GetPathRoot(target))throw new Exception("Destino inválido.");Directory.CreateDirectory(parent);string stage=Path.Combine(parent,".gz-restore-"+Guid.NewGuid().ToString("N")),previous=target+"-anterior-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,6);using(var zip=ZipFile.OpenRead(file)){var manifest=Manifest(zip);Validate(zip,manifest);Directory.CreateDirectory(stage);foreach(var item in manifest.files){if(!item.path.StartsWith("dados/",StringComparison.Ordinal))continue;string name=item.path.Substring(6);if(name.StartsWith("prime-arena.sqlite",StringComparison.Ordinal))name="gamezoney.sqlite"+name.Substring(18);string path=Safe(stage,name);Directory.CreateDirectory(Path.GetDirectoryName(path));zip.GetEntry(item.path).ExtractToFile(path);}}
  bool moved=false;try{if(Directory.Exists(target)){Directory.Move(target,previous);moved=true;}Directory.Move(stage,target);}catch{if(moved&&!Directory.Exists(target))Directory.Move(previous,target);throw;}Console.WriteLine("Restauração concluída. Dados anteriores: "+(moved?previous:"nenhum"));
 }
 static int Main(string[] args){try{if(args.Length!=3)throw new Exception("Argumentos inválidos.");if(args[0]=="pack"){using(var output=ZipFile.Open(args[2],ZipArchiveMode.Create)){string source=LongPath(args[1]).TrimEnd(Path.DirectorySeparatorChar);foreach(string input in Directory.GetFiles(source,"*",SearchOption.AllDirectories))output.CreateEntryFromFile(input,input.Substring(source.Length+1).Replace(Path.DirectorySeparatorChar,'/'),CompressionLevel.Optimal);}using(var zip=ZipFile.OpenRead(args[2]))Validate(zip,Manifest(zip));}else if(args[0]=="restore")Restore(args[1],args[2]);else throw new Exception("Comando inválido.");return 0;}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
