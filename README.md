# Vida OS — meu sistema pessoal

Um sistema único para a vida toda: **finanças, investimentos, estudos, fitness e agenda**.
Funciona direto no navegador (computador ou celular), **sem servidor e sem login** — seus dados ficam só no seu aparelho.

## Como abrir

- **Mais fácil:** ative o GitHub Pages (Settings → Pages → Branch `main` / pasta raiz) e abra o link no celular. Dá para "Adicionar à tela inicial" e usar como app, inclusive offline.
- **No computador:** baixe o repositório e dê dois cliques no `index.html`.
  (Ou rode `python3 -m http.server` na pasta e abra `http://localhost:8000`.)

## O que tem

### 💰 Finanças
- **Parcelas & dívidas:** cadastre a compra (parcela + nº de parcelas, ou o total). O sistema mostra a parcela do mês (ex.: 4/10), quantas faltam, quanto falta pagar, a soma de cada mês até quitar tudo e **em que mês você fica livre das parcelas**.
- **Subir relatório do mês:** CSV (Nubank, Inter, C6…), OFX, Excel ou PDF de fatura. Ele **categoriza sozinho** (comida, mercado, farmácia, lazer…), ignora duplicados e pagamentos, e **detecta compras parceladas** ("Parcela 3/10") para criar o parcelamento automaticamente.
- **Gastos:** filtre por dia, semana, mês, ano ou período; busque por nome, valor ou nota; gráficos por categoria e evolução no tempo. Se você corrige uma categoria, ele **aprende** aquele estabelecimento.
- **Orçamento** por categoria, **cartões** (fechamento e vencimento aparecem na agenda).

### 📈 Investimentos
- **FIIs:** cotas, preço médio, cotação, último dividendo → renda mensal, DY, yield on cost e **número mágico**. Atualização automática de cotações/dividendos com token grátis da [brapi.dev](https://brapi.dev) (opcional).
- **Renda fixa:** CDB/LCI/LCA/Tesouro/caixinha com % do CDI, prefixado ou IPCA+ → valor bruto, **IR regressivo** e líquido estimados.
- **Patrimônio** por classe e instituição (XP, Nubank…), evolução mês a mês, registro de proventos e **simulador de renda passiva** (bola de neve com reinvestimento).

### 📚 Estudos
- Matérias com **PDFs** salvos no aparelho, **cronograma semanal**, **Pomodoro** que registra suas horas, metas por matéria, sequência de dias.
- **Concursos:** suba o **edital em PDF** e ele extrai datas de inscrição, isenção, pagamento, prova, **TAF**, **exames médicos**, avaliação psicológica, resultado, além de taxa, salário, vagas e banca — e joga tudo na agenda.
- Revisões espaçadas (1, 7 e 30 dias) opcionais.

### 💪 Fitness
- **Avatar do corpo animado** (frente e lado): engorda/desincha conforme peso, altura e % de gordura; **zonas de calor** mostram onde a gordura acumula (homem: barriga, peito e flancos; mulher: quadril e coxas). Linha do tempo, animação da evolução e contorno do 1º registro para comparar.
- **Atualizar medidas:** suba os arquivos da balança e do relógio Samsung (PDF, foto/print, CSV do Samsung Health ou Excel). Se mandar dois, ele mescla os valores. Tudo é editável antes de salvar.
- **Plano de treino** por dia da semana: musculação (séries, reps, carga, descanso) e **corrida** (tipo, distância, duração, pace, zona Z1–Z5, intervalos). Importa planilha Excel/CSV e tem modelos prontos (ABC, preparação para TAF, 5 km).
- **Registro de treino**, evolução de carga e pace, gráficos de peso/gordura/músculo, calculadoras (TMB, TDEE, calorias, proteína, água, zonas de FC).

### 📅 Agenda
Compromissos, **contas a pagar recorrentes** (marque como pago), faturas, provas, TAF, aniversários. Avisa contas atrasadas.

### ⚙️ Ajustes (personalize tudo)
Temas prontos, modo claro/escuro, cor principal e secundária, fundo, arredondamento, tamanho do texto, estilo do avatar, **renomear/reordenar/esconder abas**, escolher os blocos do painel inicial, **modo privacidade** (borra os valores), notificações e **backup/restauração** (com ou sem os PDFs).

## Privacidade e backup
Nada sai do seu navegador (exceto a consulta opcional de cotações na brapi). Como os dados ficam no aparelho, **faça backup** em Ajustes → Dados & backup de vez em quando — e use o mesmo arquivo para levar tudo para outro aparelho.

## Estrutura
```
index.html          página principal
css/style.css       visual
js/core.js          estado, armazenamento, utilidades, UI
js/parsers.js       leitura de PDF/Excel/CSV/OFX/foto + extração (fatura, bioimpedância, edital, treino)
js/body.js          avatar corporal animado
js/views/*.js       telas (início, finanças, investimentos, estudos, fitness, agenda, ajustes)
vendor/             Chart.js, pdf.js e SheetJS (locais, funcionam offline)
```
