//go:build windows

package main

import (
	"log"
	"os"
	"syscall"
	"unsafe"
)

// fatal mostra uma janela de erro (o programa não tem console no Windows).
func fatal(msg string) {
	log.Print(msg)
	u := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString("Vida OS")
	m, _ := syscall.UTF16PtrFromString(msg)
	_, _, _ = u.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
	os.Exit(1)
}

// openDefault abre o endereço no navegador padrão (ShellExecute, sem rundll32).
func openDefault(url string) {
	sh := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW")
	verb, _ := syscall.UTF16PtrFromString("open")
	u, _ := syscall.UTF16PtrFromString(url)
	_, _, _ = sh.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(u)), 0, 0, 1)
}
