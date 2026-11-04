using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("GameZoney ClearAll")]
[assembly: AssemblyVersion("3.0.34.0")]
// 3.0.34: ClearAll.exe - apaga todos os registros do servidor (clientes, contas, recargas, sessoes,
// produtos, vendas, caixas, estoque, log...) e mantem as estacoes com o pareamento das TVs e computadores.
// O trabalho e feito por clear-all.js (runtime\node.exe), com o servidor fechado.
class ClearAll {
    static string root = AppDomain.CurrentDomain.BaseDirectory;

    [STAThread] static int Main(string[] args) {
        Application.EnableVisualStyles();
        int port = 3000;
        string data = Environment.GetEnvironmentVariable("GZ_DATA_DIR");
        if (String.IsNullOrEmpty(data)) data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GameZoney", "data");
        for (int i = 0; i < args.Length - 1; i++) { if (args[i] == "/data") data = args[i + 1]; if (args[i] == "/port") port = Int32.Parse(args[i + 1]); }
        try { return Run(data, port); }
        catch (Exception e) { MessageBox.Show(e.Message, "GameZoney - ClearAll", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
    }

    static int Run(string data, int port) {
        string db = Path.Combine(data, "gamezoney.sqlite");
        if (!File.Exists(db)) { MessageBox.Show("Nenhum dado do servidor foi encontrado em:\n" + data, "GameZoney - ClearAll", MessageBoxButtons.OK, MessageBoxIcon.Information); return 0; }
        string node = Path.Combine(root, "runtime", "node.exe"), script = Path.Combine(root, "clear-all.js");
        if (!File.Exists(node) || !File.Exists(script)) throw new Exception("Arquivos do servidor não encontrados. Execute o ClearAll.exe dentro da pasta de instalação do servidor GameZoney.");

        string aviso = "ATENÇÃO: esta ação APAGA TODOS OS REGISTROS do servidor GameZoney:\n\n" +
            "• clientes, pontos fidelidade e saldos de tempo\n" +
            "• administradores e operadores (inclusive o administrador principal)\n" +
            "• recargas, faturas, sessões, promoções e prêmios\n" +
            "• produtos, serviços, vendas do PDV, caixas e estoque\n" +
            "• despesas, contas a pagar, estatísticas e Sistema de log\n\n" +
            "SERÃO MANTIDOS: as estações (TVs e computadores) com o pareamento e as configurações gerais.\n\n" +
            "Uma cópia de segurança dos dados atuais será salva antes da limpeza.\n\nDeseja continuar?";
        if (MessageBox.Show(aviso, "GameZoney - ClearAll", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return 0;
        if (MessageBox.Show("Tem certeza? Depois da limpeza será necessário criar novamente o administrador principal no primeiro acesso ao painel.", "GameZoney - Confirmar limpeza", MessageBoxButtons.YesNo, MessageBoxIcon.Exclamation, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return 0;

        // O mesmo mutex do GameZoney.exe: garante que o servidor nao esta aberto (e nao abre) durante a limpeza.
        bool created;
        using (var mutex = new Mutex(true, "Local\\GameZoneyServer_" + port, out created)) {
            if (!created) {
                mutex.Dispose();
                if (MessageBox.Show("O servidor GameZoney está aberto. Fechar o servidor agora para continuar a limpeza?", "GameZoney - ClearAll", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return 0;
                StopServer();
                return RunLocked(data, port, node, script, 0);
            }
            try { return Clear(data, node, script); } finally { mutex.ReleaseMutex(); }
        }
    }

    static int RunLocked(string data, int port, string node, string script, int attempt) {
        bool created;
        using (var mutex = new Mutex(true, "Local\\GameZoneyServer_" + port, out created)) {
            if (!created) {
                if (attempt >= 20) throw new Exception("Não foi possível fechar o servidor. Feche o GameZoney pelo ícone ao lado do relógio (Sair) e execute o ClearAll novamente.");
                Thread.Sleep(500);
                return RunLocked(data, port, node, script, attempt + 1);
            }
            try { return Clear(data, node, script); } finally { mutex.ReleaseMutex(); }
        }
    }

    static bool SamePath(Process p, string file) {
        try { return String.Equals(Path.GetFullPath(p.MainModule.FileName), Path.GetFullPath(file), StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }

    static void StopServer() {
        string launcher = Path.Combine(root, "GameZoney.exe"), node = Path.Combine(root, "runtime", "node.exe");
        foreach (var p in Process.GetProcessesByName("GameZoney")) { try { if (SamePath(p, launcher)) { p.Kill(); p.WaitForExit(5000); } } catch { } }
        foreach (var p in Process.GetProcessesByName("node")) { try { if (SamePath(p, node)) { p.Kill(); p.WaitForExit(5000); } } catch { } }
        Thread.Sleep(1000);
    }

    static int Clear(string data, string node, string script) {
        var info = new ProcessStartInfo(node, "--disable-warning=ExperimentalWarning \"" + script + "\" \"" + data + "\"");
        info.WorkingDirectory = root; info.UseShellExecute = false; info.CreateNoWindow = true;
        info.RedirectStandardOutput = true; info.RedirectStandardError = true;
        info.StandardOutputEncoding = System.Text.Encoding.UTF8; info.StandardErrorEncoding = System.Text.Encoding.UTF8;
        using (var p = Process.Start(info)) {
            string output = p.StandardOutput.ReadToEnd(), error = p.StandardError.ReadToEnd();
            p.WaitForExit();
            if (p.ExitCode != 0) throw new Exception("A limpeza não foi concluída. Nenhum dado foi alterado.\n\n" + error.Trim());
            MessageBox.Show(output.Trim() + "\n\nAbra o servidor novamente e crie o administrador principal.", "GameZoney - Limpeza concluída", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        return 0;
    }
}
