# Importar clientes por planilha

Em **Clientes > Importar planilha** (somente o **administrador principal**, a primeira conta criada) envie um arquivo do Excel (.xlsx) ou CSV com as colunas:

| Nome | Nick | Tempo | Pontos fidelidade |
|---|---|---|---|
| João da Silva | joao.silva | 01:30 | 150 |
| Maria Souza | maria_s | 90 | 0 |

- **Tempo**: `01:30` (horas:minutos), `1:05:10`, `90` (minutos), `1h30`, `45min`, `2 horas`. Se a coluna se chamar "Horas", números são horas. Células formatadas como hora no Excel também são aceitas.
- **Pontos fidelidade**: número inteiro ou decimal (`150`, `12,5`, `1.250`). Vazio = 0. A coluna é opcional: planilhas antigas só com Nome, Nick e Tempo continuam funcionando.
- **Nick**: 3 a 32 letras sem acento, números, ponto, hífen ou sublinhado (sem espaços).
- Sem cabeçalho, a ordem é: Nome, Nick, Tempo, Pontos fidelidade.
- Antes de importar, o painel mostra a prévia: novos clientes, tempo e pontos totais, já cadastrados (não são alterados) e linhas com erro.
- Cada cliente entra **sem senha**: ao iniciar a primeira sessão no PC ele cadastra a senha, igual ao cadastro manual sem senha.
- O tempo entra como saldo disponível (não gera faturamento). Os pontos entram como saldo inicial e aparecem no extrato de pontos (Fidelidade) como "Importação de planilha".
- A importação fica registrada em Sessão e log > Sistema de log.
