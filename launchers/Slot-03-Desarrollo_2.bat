@echo off
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -File "%~dp0AccountHub-Codex.ps1" -Slot 3 -ProjectPath "%CD%"
