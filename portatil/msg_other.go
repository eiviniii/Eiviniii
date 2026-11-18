//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

func fatal(msg string) {
	fmt.Fprintln(os.Stderr, "Vida OS: "+msg)
	os.Exit(1)
}

func openDefault(url string) {
	if runtime.GOOS == "darwin" {
		_ = exec.Command("open", url).Start()
		return
	}
	_ = exec.Command("xdg-open", url).Start()
}
