#Requires -Version 5.1
<#
.SYNOPSIS
    Converts the local MongoDB Windows service into a single-node replica set.

.DESCRIPTION
    Prisma's MongoDB connector wraps EVERY write in a transaction, and MongoDB
    only supports transactions on a replica set. While MongoDB runs as a
    standalone server, every prisma.<model>.create/update/delete fails with:

        Prisma needs to perform transactions, which requires your MongoDB
        server to be run as a replica set.

    This script adds `replication.replSetName` to mongod.cfg and restarts the
    service. It does NOT touch your data directory, port, or bind address.

    RUN THIS FROM AN ELEVATED POWERSHELL (Win+X, then "Terminal (Admin)").

.NOTES
    Reversible: your original config is copied to mongod.cfg.bak first.
    After this completes, run:  npm run db:replica-set
#>
[CmdletBinding()]
param(
    [string] $ReplSetName = 'rs0'
)

$ErrorActionPreference = 'Stop'

# --- helpers ---------------------------------------------------------------

function Assert-Administrator {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This script must run as Administrator. Press Win+X and choose "Terminal (Admin)", then run it again.'
    }
}

function Get-MongoService {
    $service = Get-CimInstance Win32_Service -Filter "Name='MongoDB'" -ErrorAction SilentlyContinue
    if (-not $service) { throw "The Windows service 'MongoDB' was not found." }
    return $service
}

function Get-MongoConfigPath {
    param([string] $ServiceCommandLine)

    # ServiceCommandLine looks like:
    #   "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --config "C:\...\mongod.cfg" --service
    $match = [regex]::Match($ServiceCommandLine, '--config\s+(?:"([^"]+)"|(\S+))')
    if (-not $match.Success) {
        throw "Could not find '--config' in the MongoDB service command line: $ServiceCommandLine"
    }

    if ($match.Groups[1].Success) { return $match.Groups[1].Value }
    return $match.Groups[2].Value
}

function Test-MongoPort {
    param([string] $ComputerName = '127.0.0.1', [int] $Port = 27017)

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect($ComputerName, $Port)
        $client.Close()
        return $true
    }
    catch {
        return $false
    }
}

# --- main ------------------------------------------------------------------

Assert-Administrator

$service     = Get-MongoService
$configPath  = Get-MongoConfigPath -ServiceCommandLine $service.PathName

Write-Host "MongoDB config : $configPath"
Write-Host "Replica set    : $ReplSetName"
Write-Host ''

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Config file not found: $configPath"
}

$original = Get-Content -LiteralPath $configPath -Raw

if ($original -match "(?m)^\s*replSetName:\s*$ReplSetName\s*$") {
    Write-Host "Config already sets replSetName: $ReplSetName. Skipping the file edit."
}
else {
    Copy-Item -LiteralPath $configPath -Destination "$configPath.bak" -Force
    Write-Host "Backed up original config to $configPath.bak"

    if ($original -match '(?m)^[ \t]*#\s*replication:\s*$') {
        # Replace the commented-out placeholder in place, so the block lands in
        # its documented position instead of being appended to the file end.
        $updated = $original -replace '(?m)^[ \t]*#\s*replication:[ \t]*\r?\n', "replication:`r`n  replSetName: $ReplSetName`r`n"
        Write-Host 'Uncommented the existing "#replication:" placeholder.'
    }
    else {
        $updated = $original.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: $ReplSetName`r`n"
        Write-Host 'Appended a new "replication:" block.'
    }

    # Write without a BOM - mongod's YAML parser is happier that way.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($configPath, $updated, $utf8NoBom)

    Write-Host 'Config updated.'
}

Write-Host ''
Write-Host 'Restarting the MongoDB service...'
Restart-Service -Name 'MongoDB' -Force

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not (Test-MongoPort)) {
    Start-Sleep -Milliseconds 500
}

if (Test-MongoPort) {
    Write-Host 'MongoDB is listening again on 127.0.0.1:27017.'
}
else {
    Write-Warning 'Timed out waiting for 127.0.0.1:27017 to accept connections. Check the MongoDB service and its log.'
}

Write-Host ''
Write-Host 'Done. Next step (a normal, non-elevated terminal):'
Write-Host ''
Write-Host '    npm run db:replica-set'
Write-Host ''
