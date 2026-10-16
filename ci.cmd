@echo off
rem FarmCart continuous integration (XP): runs ci.ps1 without changing the PowerShell execution policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ci.ps1" %*
