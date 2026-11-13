using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("GameZoney ClearAd")]
[assembly: System.Reflection.AssemblyCompany("GameZoney")]
[assembly: System.Reflection.AssemblyProduct("GameZoney")]
[assembly: System.Reflection.AssemblyDescription("GameZoney - redefinir a senha do administrador principal")]
[assembly: System.Reflection.AssemblyCopyright("© 2026 GameZoney. Todos os direitos reservados.")]
[assembly: System.Reflection.AssemblyTrademark("GameZoney")]
[assembly: AssemblyVersion("1.4.3.0")]
// 1.4.3: ClearAd.exe (substitui o ClearAll.exe) - redefine a senha do ADMINISTRADOR PRINCIPAL quando ela foi esquecida.
// Roda no computador do servidor, com o servidor ENCERRADO (o mesmo mutex do GameZoney.exe garante isso e impede que ele
// abra durante a troca). O trabalho é feito por clear-admin.js (runtime\node.exe); a senha nova vai pela entrada padrão,
// nunca pela linha de comando. Nada mais muda: clientes, vendas, configurações e outras contas ficam como estão.
class ClearAd {
    static string root = AppDomain.CurrentDomain.BaseDirectory;
    const string Title = "GameZoney - ClearAd";

    [STAThread] static int Main(string[] args) {
        Application.EnableVisualStyles();
        int port = 3000;
        string data = Environment.GetEnvironmentVariable("GZ_DATA_DIR");
        if (String.IsNullOrEmpty(data)) data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GameZoney", "data");
        for (int i = 0; i < args.Length - 1; i++) { if (args[i] == "/data") data = args[i + 1]; if (args[i] == "/port") port = Int32.Parse(args[i + 1]); }
        try { return Run(data, port); }
        catch (Exception e) { MessageBox.Show(e.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
    }

    static int Run(string data, int port) {
        string db = Path.Combine(data, "gamezoney.sqlite");
        if (!File.Exists(db)) { MessageBox.Show("Nenhum dado do servidor foi encontrado neste usuário do Windows:\n" + data + "\n\nExecute o ClearAd no mesmo usuário do Windows em que o GameZoney Servidor é usado.", Title, MessageBoxButtons.OK, MessageBoxIcon.Information); return 0; }
        string node = Path.Combine(root, "runtime", "node.exe"), script = Path.Combine(root, "clear-admin.js");
        if (!File.Exists(node) || !File.Exists(script)) throw new Exception("Arquivos do servidor não encontrados. Execute o ClearAd.exe dentro da pasta de instalação do GameZoney Servidor.");

        bool created;
        using (var mutex = new Mutex(true, "Local\\GameZoneyServer_" + port, out created)) {
            if (!created) {
                MessageBox.Show("O servidor GameZoney está aberto.\n\nEncerre o servidor primeiro (ícone do GameZoney ao lado do relógio › Sair) e execute o ClearAd de novo.", Title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return 0;
            }
            try {
                string infoJson = RunNode(node, script, data, true, null);
                string user = JsonText(infoJson, "username");
                using (var form = new PasswordForm(user)) {
                    if (form.ShowDialog() != DialogResult.OK) return 0;
                    string result = RunNode(node, script, data, false, form.Password);
                    string bak = JsonText(result, "backup");
                    MessageBox.Show("Senha redefinida.\n\nAbra o GameZoney Servidor e entre com:\nUsuário: " + JsonText(result, "username") + "\nSenha: a senha nova que você digitou.\n\nAs sessões abertas dessa conta foram encerradas e a troca ficou registrada no Log.\nCópia dos dados antes da troca: " + Path.GetFileName(bak), "GameZoney - Senha redefinida", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return 0;
                }
            } finally { mutex.ReleaseMutex(); }
        }
    }

    static string RunNode(string node, string script, string data, bool info, string password) {
        var psi = new ProcessStartInfo(node, "--disable-warning=ExperimentalWarning \"" + script + "\" \"" + data + "\"" + (info ? " --info" : ""));
        psi.WorkingDirectory = root; psi.UseShellExecute = false; psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true; psi.RedirectStandardError = true; psi.RedirectStandardInput = true;
        psi.StandardOutputEncoding = System.Text.Encoding.UTF8; psi.StandardErrorEncoding = System.Text.Encoding.UTF8;
        foreach (var k in new[] { "NODE_OPTIONS", "NODE_PATH", "NODE_EXTRA_CA_CERTS" }) psi.EnvironmentVariables.Remove(k);
        using (var p = Process.Start(psi)) {
            var input = new StreamWriter(p.StandardInput.BaseStream, new System.Text.UTF8Encoding(false));
            if (password != null) input.Write(password);
            input.Close();
            string output = p.StandardOutput.ReadToEnd(), error = p.StandardError.ReadToEnd();
            p.WaitForExit();
            if (p.ExitCode != 0) throw new Exception((info ? "" : "A senha não foi alterada.\n\n") + (error.Trim().Length > 0 ? error.Trim() : "Falha ao abrir os dados do servidor."));
            return output;
        }
    }

    // leitura simples de um campo de texto do JSON devolvido por clear-admin.js
    static string JsonText(string json, string key) {
        var m = System.Text.RegularExpressions.Regex.Match(json ?? "", "\"" + key + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"");
        if (!m.Success) return "";
        return System.Text.RegularExpressions.Regex.Unescape(m.Groups[1].Value);
    }

    class PasswordForm : Form {
        TextBox first = new TextBox(), second = new TextBox();
        Label error = new Label();
        public string Password { get { return first.Text; } }
        public PasswordForm(string user) {
            Text = Title; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(440, 300); Font = new Font("Segoe UI", 9.5f); BackColor = Color.FromArgb(16, 17, 21); ForeColor = Color.Gainsboro;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            var title = new Label { Text = "Redefinir a senha do administrador principal", Font = new Font("Segoe UI", 11f, FontStyle.Bold), ForeColor = Color.FromArgb(253, 208, 52), AutoSize = false, Bounds = new Rectangle(20, 16, 400, 24) };
            var who = new Label { Text = "Usuário: " + user + "\nUse quando a senha foi esquecida. Só a senha desta conta muda; clientes, vendas e configurações continuam iguais.", AutoSize = false, Bounds = new Rectangle(20, 46, 400, 54) };
            var l1 = new Label { Text = "Nova senha (8 a 24 caracteres)", AutoSize = false, Bounds = new Rectangle(20, 106, 400, 20) };
            first.Bounds = new Rectangle(20, 128, 400, 26); first.UseSystemPasswordChar = true; first.MaxLength = 24;
            var l2 = new Label { Text = "Repita a nova senha", AutoSize = false, Bounds = new Rectangle(20, 162, 400, 20) };
            second.Bounds = new Rectangle(20, 184, 400, 26); second.UseSystemPasswordChar = true; second.MaxLength = 24;
            error.Bounds = new Rectangle(20, 216, 400, 22); error.ForeColor = Color.FromArgb(255, 120, 120);
            var ok = new Button { Text = "Redefinir senha", Bounds = new Rectangle(214, 250, 130, 32), BackColor = Color.FromArgb(240, 177, 30), ForeColor = Color.Black, FlatStyle = FlatStyle.Flat };
            var cancel = new Button { Text = "Cancelar", Bounds = new Rectangle(350, 250, 70, 32), DialogResult = DialogResult.Cancel, FlatStyle = FlatStyle.Flat };
            ok.Click += (s, e) => {
                if (first.Text.Length < 8 || first.Text.Length > 24) { error.Text = "A senha deve ter entre 8 e 24 caracteres."; return; }
                if (first.Text != second.Text) { error.Text = "As duas senhas não são iguais."; return; }
                if (MessageBox.Show("Trocar a senha do administrador principal agora?", Title, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
                DialogResult = DialogResult.OK; Close();
            };
            Controls.AddRange(new Control[] { title, who, l1, first, l2, second, error, ok, cancel });
            AcceptButton = ok; CancelButton = cancel;
        }
    }
}
