# Vida OS — meu sistema pessoal

Um sistema único para a vida toda: **finanças, investimentos, estudos, fitness e agenda**.
Funciona direto no navegador (computador ou celular), **sem servidor e sem login** — seus dados ficam só no seu aparelho.

## Como abrir

### 💾 No pendrive (recomendado — nada fica no computador)
1. Copie **só o programa** para uma pasta no pendrive (ex.: `E:\VidaOS\`):
   - **Windows:** `VidaOS-Windows.exe` · **Mac:** `VidaOS-Mac` (M1/M2/M3…) ou `VidaOS-Mac-Intel` · **Linux:** `VidaOS-Linux`
   - O sistema inteiro já vem **dentro** do programa. Não precisa de mais nenhum arquivo.
2. Dois cliques nele. Ele abre o Vida OS numa janela própria e cria a pasta **`dados`** ao lado — é lá que fica tudo (inclusive o perfil do navegador). Fechou a janela, o programa encerra sozinho.
3. Antes de tirar o pendrive, use **⏏️ Sair com segurança**.
4. Para atualizar: substitua só o programa. A pasta `dados` continua.

Extras do modo pendrive:
- **📱 Usar no celular (mesma Wi-Fi):** em Ajustes → Armazenamento, ligue e escaneie o QR Code. O celular acessa o Vida OS do PC pelo navegador; nada fica salvo no celular. PC e celular sincronizam sozinhos (se os dois salvarem juntos, as mudanças são unidas). Desligue quando terminar.
- **Cofre no estilo KeePassXC** (Ajustes → Armazenamento & segurança):
  - senha-mestra com medidor de força + **arquivo-chave opcional** (2º fator: sem o arquivo, a senha sozinha não abre);
  - criptografia **AES‑256‑GCM** de todos os dados e PDFs; chave derivada com **PBKDF2‑SHA256, 600 mil iterações**;
  - bloqueio automático por inatividade e **ao minimizar a janela**.
  - ⚠️ Não existe "esqueci a senha": sem a senha (e o arquivo-chave, se usar), os dados não podem ser recuperados.
- **Cópias de segurança automáticas** em `dados/backups` (a cada 15 min de uso, guarda as 40 últimas).
- O programa usa o Edge/Chrome/Brave que já existe no computador (só como "motor", com perfil no pendrive). Se quiser zero dependência, coloque um Chrome portátil em `navegador/` dentro da pasta.

> ⚠️ Na 1ª vez o Windows pode mostrar "O Windows protegeu o computador" (o programa não tem assinatura paga). Clique em **Mais informações → Executar assim mesmo**. O código-fonte está em `portatil/main.go` e pode ser recompilado com `portatil/build.sh`.

**Sem o programa:** abrindo o `index.html` no Chrome/Edge, vá em Ajustes → Armazenamento → **"Escolher pasta no pendrive"** — os dados passam a ser gravados direto nessa pasta.

### 🌐 No navegador / celular
Abra o `index.html` (ou publique no GitHub Pages: Settings → Pages). Nesse modo os dados ficam no navegador; use **Backup completo** para levar de um aparelho para outro. (Celulares não executam programas a partir de pendrive.)

## O que tem

### 💰 Finanças
- **Contas & saldo:** cadastre suas contas (Nubank, Itaú…) e o **salário como receita fixa** — ele entra sozinho todo mês. Cada gasto lançado já desconta e mostra **quanto você tem agora** e a **previsão para o fim do mês**. Pagar uma conta na agenda também desconta do saldo.
- **Orçamento & metas:** veja para onde vai o salário (contas fixas, parcelas, metas, investimento, gastos variáveis) e **quanto sobra**. Metas (ex.: casamento R$ 10 mil): informe quanto guarda por mês *ou* a data, e ele calcula quando chega — a meta vira um "gasto fixo" até ser atingida.
- **Sem duplicar:** ao subir a fatura, qualquer item com **mesmo dia e mesmo valor** de algo que você já lançou é ignorado (mesmo com nome diferente).
- **Assinaturas:** detecta sozinho as cobranças que se repetem todo mês (Netflix, academia, planos…) com total mensal e anual.
- **Oportunidades e alertas:** projeção do mês, categorias acima da média, assinaturas, delivery, receita × despesa e mapa de gastos por dia.
- **Parcelas & dívidas:** cadastre a compra (parcela + nº de parcelas, ou o total). O sistema mostra a parcela do mês (ex.: 4/10), quantas faltam, quanto falta pagar, a soma de cada mês até quitar tudo e **em que mês você fica livre das parcelas**.
- **Subir relatório do mês:** CSV (Nubank, Inter, C6…), OFX, Excel ou PDF de fatura. Ele **categoriza sozinho** (comida, mercado, farmácia, lazer…), ignora duplicados e pagamentos, e **detecta compras parceladas** ("Parcela 3/10") para criar o parcelamento automaticamente.
- **Gastos:** filtre por dia, semana, mês, ano ou período; busque por nome, valor ou nota; gráficos por categoria e evolução no tempo. Se você corrige uma categoria, ele **aprende** aquele estabelecimento.
- **Orçamento** por categoria, **cartões** (fechamento e vencimento aparecem na agenda).

- **Nota de saúde financeira (0–100)** com 3 dicas práticas (reserva, sobra do salário, dívidas, investimentos, controle).
- **Desejos:** lista com preço, link e prioridade, e quando dá para comprar sem estourar o orçamento.
- **Rachar contas:** quem pagou o quê, quem deve a quem (mínimo de pagamentos) e mensagem pronta para o WhatsApp.
- **Imposto de Renda organizado:** comprovantes dedutíveis (sugere gastos de saúde/educação), informes, bens em 31/12, dividendos isentos, checklist e resumo para imprimir.
- **Calculadoras:** salário líquido, férias, 13º, rescisão (tabelas de INSS/IR editáveis, com a isenção até R$ 5 mil de 2026) e **à vista × parcelado** com o dinheiro rendendo no CDI.

### 💬 Assistente (offline, sem custo)
Pergunte em português: "quanto gastei com comida em outubro?", "onde mais gastei?", "resuma meu mês", "quando vence minha CNH?", "quanto falta para a meta?". Ele responde com os seus dados, sem internet e sem IA paga. Também funciona digitando a pergunta na busca do topo.

### 📈 Investimentos
- **Planejamento:** salário → quanto investir (% ou R$) → por quantos anos → onde você chega. Considera aumento anual, 13º, extras, IR e inflação; compara CDB, FIIs, Tesouro IPCA+ e poupança; tabela **ano a ano e mês a mês com aportes editáveis**; calculadoras ("quanto investir para ter X", "em quanto tempo chego", "quanto preciso para viver de renda").
- **FIIs:** cotas, preço médio, cotação, último dividendo → renda mensal, DY, yield on cost e **número mágico**. Atualização automática de cotações/dividendos com token grátis da [brapi.dev](https://brapi.dev) (opcional).
- **Renda fixa:** CDB/LCI/LCA/Tesouro/caixinha com % do CDI, prefixado ou IPCA+ → valor bruto, **IR regressivo** e líquido estimados.
- **Patrimônio** por classe e instituição (XP, Nubank…), evolução mês a mês, registro de proventos e **simulador de renda passiva** (bola de neve com reinvestimento).

### 📁 Documentos
CNH, RG, CPF, certidões, reservista, comprovantes… Anexe frente/verso (foto ou PDF), com número, órgão, validade, categoria e de quem é (você ou família).
- **Garantias & notas fiscais:** guarde a NF com o prazo de garantia; avisa antes de acabar.
- **🆘 Ficha de emergência:** tipo sanguíneo, alergias, remédios, plano de saúde e contatos (ligar/WhatsApp). Pode aparecer na **tela de bloqueio** do cofre para quem te socorrer — só a ficha, o resto continua criptografado.
 Busca e filtros, botão de copiar o número, miniaturas, visualizador com zoom/giro, **aviso de vencimento** (também na Agenda e no Início) e lista de **documentos essenciais** que ainda faltam. No pendrive com senha, tudo fica criptografado.

### ✈️ Viagens
Orçamento por categoria × gasto real (dá para puxar os lançamentos do período), roteiro por dia, checklist de mala e documentos, custo por pessoa e combustível estimado com o consumo real do carro.

### 🗒️ Caderno
Notas com pastas, fixar, cores, anexos e busca; linhas `[ ]` viram caixinhas marcáveis.

### ✅ Rotina
- Tarefas com prioridade e prazo (aparecem na Agenda) e hábitos diários com sequência de dias.
- **Lista de compras** por seção do mercado, com **histórico de preços** (último, menor e onde), "compra de sempre" e "finalizar compra" que lança o gasto.
- **Conquistas:** XP, níveis e 22 medalhas (treinos, estudo, hábitos, peso, mês no azul, reserva, metas, documentos…).

### 🚗 Veículo
Km atual, manutenções com intervalo por km e por tempo (óleo, filtros, pneus, correia, freios, bateria…) avisando o que vence, **IPVA, licenciamento e seguro** na Agenda, abastecimentos com **consumo real** (km rodados ÷ litros: km/L, R$/km, gasto a cada 100 km, por combustível), **etanol × gasolina pelo consumo real do seu carro**, **calculadora de custo de viagem** e o **custo do carro por mês** (inclui os gastos de posto das faturas).

### 🕐 Relógio e 🌤️ clima
Relógio em tela cheia (hora, minuto, segundo, data, clima e próximos compromissos) que **mantém a tela acesa**. Previsão do tempo da sua cidade (Open-Meteo, grátis): agora, por hora e 7 dias, com chuva, UV, nascer/pôr do sol e dicas do dia.

### 🔗 Sites úteis
Atalhos com logo, descrição e etiquetas — pesquise "remover fundo", "juntar pdf", "extrair texto"… Contato de WhatsApp direto, mais de 50 sugestões prontas e atalhos fixados no painel inicial. Aparecem também na busca geral (Ctrl+K).

### 📚 Estudos
- **Biblioteca:** suba o PDF com a data, matéria e assunto; depois **pesquise qualquer palavra que esteja dentro dele** (mostra o trecho destacado). Funciona offline.
- Matérias com **PDFs** salvos no aparelho, **cronograma semanal**, **Pomodoro** que registra suas horas, metas por matéria, sequência de dias.
- **Concursos:** suba o **edital em PDF** e ele extrai datas de inscrição, isenção, pagamento, prova, **TAF**, **exames médicos**, avaliação psicológica, resultado, além de taxa, salário, vagas e banca — e joga tudo na agenda.
- **🗺️ Mapa do edital:** lê o conteúdo programático do PDF do edital (ou texto colado) e vira checklist de tópicos por matéria, com % dominado, ritmo necessário até a prova e ▶ para estudar o tópico no Pomodoro.
- **📝 Questões:** suba o PDF de questões, escolha matéria e assunto e o sistema transcreve tudo em múltipla escolha (A–E) ou Certo/Errado. Ele reconhece numeração `01)`, alternativas `a)`, a banca/órgão/ano do cabeçalho `(Cargo – Órgão – 2023 – BANCA)` e o gabarito no fim (tabela `1 2 3` / `A E A` ou lista `1-A 2-C`). Questões com frações ou contas aparecem como **imagem recortada do PDF**, para nada sair torto. Antes de salvar dá para conferir e corrigir. Modo **treino** (corrige na hora) ou **simulado** (com tempo, corrige no fim), atalhos de teclado, caderno de erros, favoritas e desempenho por matéria e assunto.
- **🧠 Mapas mentais:** suba imagens ou PDFs por matéria e conteúdo. Galeria com miniaturas, filtros e busca. Visualizador com zoom (rodinha), arrastar, tela cheia e ← → para passar entre os mapas. Botão **“Revisei hoje”** com revisão espaçada (1, 3, 7, 15, 30 e 60 dias). Os mapas a revisar aparecem no Painel de Estudos.
