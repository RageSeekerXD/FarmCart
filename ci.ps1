<#
.SYNOPSIS
    Безперервна інтеграція FarmCart (практика XP «Continuous Integration»).
.DESCRIPTION
    Інтеграцію приймають лише тоді, коли код відповідає стандарту кодування, збирається
    без попереджень, проходять 100 % модульних і приймальних тестів, а покриття рядків
    коду автотестами не нижче порогу (B-NFR-08: не менше 70 %).
.EXAMPLE
    .\ci.cmd
    powershell -ExecutionPolicy Bypass -File ci.ps1 -MinCoverage 80
#>
param([int]$MinCoverage = 70)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$artifacts = Join-Path $PSScriptRoot 'artifacts'
$watch = [Diagnostics.Stopwatch]::StartNew()

function Invoke-Step([string]$Title, [scriptblock]$Command) {
    Write-Host "==> $Title" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ІНТЕГРАЦІЮ ВІДХИЛЕНО на кроці: $Title" -ForegroundColor Red
        exit 1
    }
}

if (Test-Path $artifacts) { Remove-Item $artifacts -Recurse -Force }

Invoke-Step '1/5 Відновлення залежностей' {
    dotnet restore --verbosity quiet
    if ($LASTEXITCODE -eq 0) { dotnet tool restore | Out-Null }
}
Invoke-Step '2/5 Стандарт кодування (dotnet format --verify-no-changes)' {
    dotnet format --verify-no-changes --no-restore
}
Invoke-Step '3/5 Збірка Release (попередження = помилки)' {
    dotnet build --configuration Release --no-restore --verbosity quiet
}
# Покриття - Microsoft Code Coverage з динамічною інструментацією (coverage.runsettings): збірки на диску
# не переписуються, тому Windows Smart App Control не блокує їх під час тестів.
Invoke-Step '4/5 Модульні й приймальні тести з покриттям' {
    dotnet test --configuration Release --no-build --verbosity quiet --results-directory "$artifacts/tests" `
        --logger trx --logger "console;verbosity=minimal" --settings coverage.runsettings --collect "Code Coverage;Format=cobertura"
}
Invoke-Step '5/5 Звіт про покриття' {
    dotnet reportgenerator "-reports:$artifacts/tests/**/*.cobertura.xml" "-targetdir:$artifacts/coverage" `
        "-reporttypes:TextSummary;Html;Cobertura" "-assemblyfilters:+FarmCart.Core;+FarmCart.Api" "-filefilters:-*.g.cs" "-verbosity:Warning"
}

# Підсумок для трекера: кількість тестів і покриття. -LiteralPath: імена файлів TRX можуть містити «[1]».
$counters = Get-ChildItem "$artifacts/tests" -Filter *.trx -Recurse |
    ForEach-Object { ([xml](Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8)).TestRun.ResultSummary.Counters }
$total = ($counters | Measure-Object -Property total -Sum).Sum
$passed = ($counters | Measure-Object -Property passed -Sum).Sum
$coverage = ([xml](Get-Content -LiteralPath "$artifacts/coverage/Cobertura.xml" -Raw -Encoding UTF8)).coverage
$lineRate = [math]::Round([double]$coverage.'line-rate' * 100, 1)
$branchRate = [math]::Round([double]$coverage.'branch-rate' * 100, 1)

Write-Host ''
Write-Host "Тести: $passed з $total пройдено; покриття рядків: $lineRate %, гілок: $branchRate %"
if ($passed -ne $total -or $lineRate -lt $MinCoverage) {
    Write-Host "ІНТЕГРАЦІЮ ВІДХИЛЕНО: потрібні 100 % пройдених тестів і покриття не нижче $MinCoverage %" -ForegroundColor Red
    exit 1
}
Write-Host ('ІНТЕГРАЦІЯ УСПІШНА за {0:0} с' -f $watch.Elapsed.TotalSeconds) -ForegroundColor Green
