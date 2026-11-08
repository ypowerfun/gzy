using System;using System.IO;using System.Security.Cryptography;using System.Security.Cryptography.X509Certificates;
[assembly: System.Reflection.AssemblyTitle("GameZoney CertTool")]
[assembly: System.Reflection.AssemblyCompany("GameZoney")]
[assembly: System.Reflection.AssemblyProduct("GameZoney")]
[assembly: System.Reflection.AssemblyDescription("GameZoney - certificado da conexão dos PCs")]
[assembly: System.Reflection.AssemblyCopyright("© 2026 GameZoney. Todos os direitos reservados.")]
[assembly: System.Reflection.AssemblyTrademark("GameZoney")]
class CertTool{static void Main(string[] args){using(var rsa=new RSACng(2048)){var req=new CertificateRequest("CN=GameZoney",rsa,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);req.CertificateExtensions.Add(new X509BasicConstraintsExtension(false,false,0,false));req.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature|X509KeyUsageFlags.KeyEncipherment,false));using(var cert=req.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1),DateTimeOffset.UtcNow.AddYears(5))){File.WriteAllBytes(args[0],cert.Export(X509ContentType.Pfx,""));File.WriteAllBytes(args[0]+".cer",cert.Export(X509ContentType.Cert));}}}}
