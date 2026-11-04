using System;using System.IO;using System.Threading;
class Dummy {static void Main(string[] args){if(args.Length>0&&args[0]=="hold"){Thread.Sleep(30000);return;}File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"restarted.txt"),"restart\n");}}
