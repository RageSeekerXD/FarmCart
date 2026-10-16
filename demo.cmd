@echo off
rem FarmCart run protocol: starts the API with demo data, runs the release scenario, saves docs\protocol.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0demo.ps1" %*
