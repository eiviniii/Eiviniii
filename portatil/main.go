// Vida OS — programa portátil.
//
// Fica no pendrive, ao lado do index.html. Ao abrir:
//  1. sobe um servidor local (só 127.0.0.1, protegido por token aleatório);
//  2. abre o Edge/Chrome/Brave em modo aplicativo com o PERFIL DO NAVEGADOR
//     dentro do pendrive (dados/navegador) — nada fica no computador;
//  3. grava tudo em dados/ (estado.json, arquivos/, backups/);
//  4. encerra sozinho quando a janela é fechada.
package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

const version = "2.0.0"

// Cópia interna do aplicativo: se algum arquivo sumir do pendrive
// (antivírus, extração incompleta…), o programa serve a cópia daqui.
//
//go:embed all:app
var embedded embed.FS

var (
	baseDir, appDir, dataDir, filesDir, backupDir string
	token                                         string
	idRe                                          = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)
	allowedData                                   = map[string]bool{"estado.json": true, "cofre.json": true}
	writeMu                                       sync.Mutex
	lastPing                                      = time.Now()
	gotPing                                       bool
	pingMu                                        sync.Mutex
	quitCh                                        = make(chan string, 4)
	lastBackup                                    time.Time
	filesInfo                                     string // para mostrar em Ajustes
	verRe                                         = regexp.MustCompile(`App\.VERSION = '([^']+)'`)
)

func main() {
	// O Windows pode informar tipos errados para .js/.css (registro do sistema);
	// fixamos os tipos para o navegador nunca recusar os scripts.
	for ext, t := range map[string]string{".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
		".html": "text/html; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm"} {
		_ = mime.AddExtensionType(ext, t)
	}
	noBrowser := flag.Bool("no-browser", false, "não abrir o navegador (apenas imprime o endereço)")
	port := flag.Int("port", 47720, "porta local preferida")
	dir := flag.String("dir", "", "pasta do aplicativo (padrão: pasta do executável)")
	flag.Parse()

	exe, _ := os.Executable()
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	baseDir = filepath.Dir(exe)
	if *dir != "" {
		baseDir, _ = filepath.Abs(*dir)
	}
	// O aplicativo inteiro vem embutido neste executável; no pendrive só fica a pasta "dados".
	appDir = baseDir
	if inTemp(baseDir) {
		fatal("Parece que o Vida OS foi aberto de dentro do arquivo .zip (pasta temporária do Windows).\n\nAssim seus dados seriam perdidos ao fechar.\n\nExtraia primeiro: abra o .zip, arraste a pasta VidaOS para o pendrive e abra o VidaOS-Windows.exe que está no pendrive.")
	}
	dataDir = filepath.Join(appDir, "dados")
	filesDir = filepath.Join(dataDir, "arquivos")
	backupDir = filepath.Join(dataDir, "backups")
	for _, d := range []string{dataDir, filesDir, backupDir} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			fatal("Não consigo gravar no pendrive:\n" + err.Error() + "\n\nVerifique se ele não está protegido contra gravação.")
		}
	}
	logf, _ := os.OpenFile(filepath.Join(dataDir, "log.txt"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if logf != nil {
		trimLog(logf)
		log.SetOutput(io.MultiWriter(os.Stderr, logf))
	}
	log.Printf("Vida OS %s iniciando em %s", version, appDir)

	// Já existe uma janela aberta? Reaproveita.
	if url := existingSession(); url != "" {
		log.Printf("sessão já ativa; abrindo de novo")
		if !*noBrowser {
			openBrowser(url, false)
		}
		return
	}

	token = randHex(24)
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			fatal("Não consegui iniciar: " + err.Error())
		}
	}
	addr := ln.Addr().(*net.TCPAddr)
	url := fmt.Sprintf("http://127.0.0.1:%d/index.html?t=%s", addr.Port, token)
	_ = os.WriteFile(filepath.Join(dataDir, ".sessao"), []byte(url), 0o600)

	// Os arquivos da pasta são da mesma versão deste programa? Se não (pasta antiga,
	// extração em outro lugar, arquivo faltando), usa a cópia interna — sempre a certa.
	if b, err := embedded.ReadFile("app/js/core.js"); err == nil {
		if m := verRe.FindSubmatch(b); m != nil {
			filesInfo = "embutido " + string(m[1])
		}
	}
	log.Printf("arquivos: %s", filesInfo)

	srv := &http.Server{Handler: guard(addr.Port, routes()), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("servidor: %v", err)
		}
	}()
	fmt.Println("VIDAOS_URL " + url)

	browserDone := make(chan struct{})
	if *noBrowser {
		close(browserDone)
	} else {
		openBrowser(url, true, browserDone)
	}

	reason := lifecycle(browserDone)
	log.Printf("encerrando: %s", reason)
	_ = os.Remove(filepath.Join(dataDir, ".sessao"))
	srv.Close()
}

// lifecycle decide quando fechar: navegador fechado + sem sinais da página.
func lifecycle(browserDone chan struct{}) string {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	browserClosed := false
	start := time.Now()
	for {
		select {
		case r := <-quitCh:
			if r == "quit" {
				time.Sleep(500 * time.Millisecond)
				return "pedido de saída"
			}
			// "bye": a página foi fechada ou recarregada — espera um pouco
			time.Sleep(8 * time.Second)
			pingMu.Lock()
			recent := time.Since(lastPing) < 8*time.Second
			pingMu.Unlock()
			if !recent {
				return "janela fechada"
			}
		case <-browserDone:
			browserClosed = true
			browserDone = nil
		case <-t.C:
			pingMu.Lock()
			idle, any := time.Since(lastPing), gotPing
			pingMu.Unlock()
			if browserClosed && any && idle > 25*time.Second {
				return "navegador fechado"
			}
			if any && idle > 120*time.Second {
				return "sem atividade"
			}
			if !any && time.Since(start) > 3*time.Minute {
				return "a página nunca abriu"
			}
		}
	}
}

/* ---------------- HTTP ---------------- */

func guard(port int, next http.Handler) http.Handler {
	okHosts := map[string]bool{fmt.Sprintf("127.0.0.1:%d", port): true, fmt.Sprintf("localhost:%d", port): true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !okHosts[r.Host] { // proteção contra DNS rebinding
			http.Error(w, "host inválido", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			t := r.Header.Get("X-Token")
			if t == "" && (r.URL.Path == "/api/bye") {
				t = r.URL.Query().Get("t")
			}
			if t != token {
				http.Error(w, "não autorizado", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{"mode": "pendrive", "version": version, "dir": dataDir, "os": runtime.GOOS, "files": filesInfo})
	})
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) { touch(); w.WriteHeader(204) })
	mux.HandleFunc("/api/bye", func(w http.ResponseWriter, r *http.Request) { quitCh <- "bye"; w.WriteHeader(204) })
	mux.HandleFunc("/api/quit", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204); quitCh <- "quit" })
	mux.HandleFunc("/api/data/", func(w http.ResponseWriter, r *http.Request) {
		touch()
		name := strings.TrimPrefix(r.URL.Path, "/api/data/")
		if !allowedData[name] {
			http.Error(w, "nome inválido", 400)
			return
		}
		serveBlob(w, r, filepath.Join(dataDir, name), name == "estado.json")
	})
	mux.HandleFunc("/api/files", func(w http.ResponseWriter, r *http.Request) {
		ents, _ := os.ReadDir(filesDir)
		ids := []string{}
		for _, e := range ents {
			if !e.IsDir() && !strings.HasPrefix(e.Name(), ".") && !strings.HasSuffix(e.Name(), ".tmp") {
				ids = append(ids, e.Name())
			}
		}
		writeJSON(w, ids)
	})
	mux.HandleFunc("/api/files/", func(w http.ResponseWriter, r *http.Request) {
		touch()
		id := strings.TrimPrefix(r.URL.Path, "/api/files/")
		if !idRe.MatchString(id) || strings.HasPrefix(id, ".") {
			http.Error(w, "id inválido", 400)
			return
		}
		serveBlob(w, r, filepath.Join(filesDir, id), false)
	})
	// arquivos do aplicativo (nunca a pasta dados nem os executáveis)
	sub, err := fs.Sub(embedded, "app")
	if err != nil {
		panic(err)
	}
	embFS := http.FileServer(http.FS(sub))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		clean := path.Clean("/" + r.URL.Path)
		rel := strings.TrimPrefix(clean, "/")
		if rel == "" || rel == "index.html" {
			b, err := fs.ReadFile(sub, "index.html")
			if err != nil {
				problemPage(w, "o aplicativo embutido está incompleto ("+err.Error()+")")
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(b)
			return
		}
		if st, err := fs.Stat(sub, rel); err == nil && !st.IsDir() {
			embFS.ServeHTTP(w, r)
			return
		}
		log.Printf("não encontrado: %s", r.URL.Path)
		if strings.Contains(r.Header.Get("Accept"), "text/html") {
			http.Redirect(w, r, "/index.html", http.StatusFound) // navegação para endereço estranho → volta ao início
			return
		}
		http.NotFound(w, r)
	})
	return mux
}

func serveBlob(w http.ResponseWriter, r *http.Request, path string, isState bool) {
	switch r.Method {
	case http.MethodGet:
		f, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = io.Copy(w, f)
	case http.MethodPut:
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 512<<20))
		if err != nil {
			http.Error(w, "arquivo grande demais", 413)
			return
		}
		writeMu.Lock()
		defer writeMu.Unlock()
		if isState {
			rotateBackup(path)
		}
		if err := atomicWrite(path, body); err != nil {
			log.Printf("erro gravando %s: %v", path, err)
			http.Error(w, "falha ao gravar: "+err.Error(), 500)
			return
		}
		w.WriteHeader(204)
	case http.MethodDelete:
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = os.Remove(path)
		w.WriteHeader(204)
	default:
		http.Error(w, "método não permitido", 405)
	}
}

// grava em arquivo temporário, força no disco (fsync) e só então substitui.
func atomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}

// cópia de segurança do estado a cada 15 min de uso; mantém as 40 mais novas.
func rotateBackup(path string) {
	if time.Since(lastBackup) < 15*time.Minute {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		return
	}
	name := "estado-" + time.Now().Format("2006-01-02_15-04-05") + ".json"
	if atomicWrite(filepath.Join(backupDir, name), data) == nil {
		lastBackup = time.Now()
	}
	ents, _ := os.ReadDir(backupDir)
	names := []string{}
	for _, e := range ents {
		if strings.HasPrefix(e.Name(), "estado-") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for len(names) > 40 {
		_ = os.Remove(filepath.Join(backupDir, names[0]))
		names = names[1:]
	}
}

/* ---------------- navegador ---------------- */

func browserCandidates() []string {
	var c []string
	switch runtime.GOOS {
	case "windows":
		for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
			root := os.Getenv(env)
			if root == "" {
				continue
			}
			c = append(c,
				filepath.Join(root, `Microsoft\Edge\Application\msedge.exe`),
				filepath.Join(root, `Google\Chrome\Application\chrome.exe`),
				filepath.Join(root, `BraveSoftware\Brave-Browser\Application\brave.exe`),
				filepath.Join(root, `Chromium\Application\chrome.exe`))
		}
	case "darwin":
		c = []string{"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Chromium.app/Contents/MacOS/Chromium"}
	default:
		for _, n := range []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"} {
			if p, err := exec.LookPath(n); err == nil {
				c = append(c, p)
			}
		}
	}
	// navegador portátil levado no próprio pendrive tem prioridade
	for _, p := range []string{"navegador/chrome.exe", "navegador/msedge.exe", "GoogleChromePortable/GoogleChromePortable.exe"} {
		c = append([]string{filepath.Join(baseDir, p)}, c...)
	}
	return c
}

func openBrowser(url string, fresh bool, done ...chan struct{}) {
	for _, b := range browserCandidates() {
		if _, err := os.Stat(b); err != nil {
			continue
		}
		profile := filepath.Join(dataDir, "navegador")
		cmd := exec.Command(b,
			"--user-data-dir="+profile, "--app="+url, "--no-first-run", "--no-default-browser-check",
			"--disable-sync", "--disable-features=Translate,MediaRouter", "--window-size=1440,920",
			"--disable-background-mode", "--disable-extensions")
		if err := cmd.Start(); err != nil {
			continue
		}
		log.Printf("navegador: %s", b)
		if len(done) > 0 {
			go func() { _ = cmd.Wait(); close(done[0]) }()
		}
		return
	}
	// nenhum navegador compatível: usa o padrão do sistema
	log.Printf("abrindo navegador padrão")
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
	if len(done) > 0 {
		close(done[0]) // não dá para acompanhar a janela; o fechamento vem pelos sinais da página
	}
}

func existingSession() string {
	b, err := os.ReadFile(filepath.Join(dataDir, ".sessao"))
	if err != nil {
		return ""
	}
	url := strings.TrimSpace(string(b))
	i := strings.Index(url, "?t=")
	if i < 0 {
		return ""
	}
	base, tok := url[:strings.Index(url, "/index.html")], url[i+3:]
	req, _ := http.NewRequest("GET", base+"/api/info", nil)
	req.Header.Set("X-Token", tok)
	c := http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := c.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	resp.Body.Close()
	return url
}

/* ---------------- util ---------------- */

// inTemp: executável rodando de pasta temporária (ex.: aberto direto de dentro do .zip)
func inTemp(dir string) bool {
	t := strings.ToLower(filepath.Clean(os.TempDir()))
	d := strings.ToLower(filepath.Clean(dir))
	return runtime.GOOS == "windows" && (strings.HasPrefix(d, t) || strings.Contains(d, `\temp\`) || strings.Contains(d, "temp1_"))
}

func problemPage(w http.ResponseWriter, msg string) {
	log.Printf("problema: %s", msg)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(500)
	fmt.Fprintf(w, `<!doctype html><meta charset="utf-8"><title>Vida OS</title><body style="font-family:system-ui;background:#0b0d14;color:#e8eaf2;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:520px;padding:24px;border-radius:16px;background:#161a26"><h2>Vida OS não conseguiu abrir</h2><p>%s</p><p>Baixe o pacote novamente e substitua o VidaOS-Windows.exe. Detalhes em <code>dados/log.txt</code>.</p><small>programa %s</small></div>`, msg, version)
}

func touch() {
	pingMu.Lock()
	lastPing, gotPing = time.Now(), true
	pingMu.Unlock()
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func randHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func trimLog(f *os.File) {
	if st, err := f.Stat(); err == nil && st.Size() > 512<<10 {
		_ = f.Truncate(0)
	}
}
