<#
.SYNOPSIS
    Протокол роботи програми FarmCart.
.DESCRIPTION
    Збирає рішення, запускає сервер у режимі розробки (з демонстраційними даними), проходить
    сценарій релізу 1 демонстраційним клієнтом і зберігає в docs\protocol протокол клієнта
    (demo-protocol.txt) та журнал запитів сервера (server-log.txt).
.EXAMPLE
    .\demo.cmd
#>
param([int]$Port = 5080)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$protocolDir = Join-Path $PSScriptRoot 'docs\protocol'
New-Item -ItemType Directory -Force $protocolDir | Out-Null

dotnet build --configuration Release --verbosity quiet | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Збірка не вдалася' -ForegroundColor Red; exit 1 }

$url = "http://localhost:$Port"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = $url
$apiDir = Join-Path $PSScriptRoot 'src\FarmCart.Api\bin\Release\net10.0'
$server = Start-Process dotnet -ArgumentList 'FarmCart.Api.dll' -WorkingDirectory $apiDir -NoNewWindow -PassThru `
    -RedirectStandardOutput (Join-Path $protocolDir 'server-log.txt') -RedirectStandardError (Join-Path $protocolDir 'server-errors.txt')
$code = 1
try {
    for ($i = 0; $i -lt 50; $i++) {
        try { Invoke-RestMethod "$url/api/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 300 }
    }

    dotnet (Join-Path $PSScriptRoot 'tools\FarmCart.Demo\bin\Release\net10.0\FarmCart.Demo.dll') $url (Join-Path $protocolDir 'demo-protocol.txt')
    $code = $LASTEXITCODE
}
finally {
    Stop-Process -Id $server.Id -Force
}

Write-Host "Протокол збережено в $protocolDir"
exit $code
