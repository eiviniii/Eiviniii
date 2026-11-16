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
