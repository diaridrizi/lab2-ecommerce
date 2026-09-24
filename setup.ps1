# FlowShop - one-click setup for Windows (PostgreSQL + MongoDB installed on Windows, no Docker)
# Run by double-clicking setup.bat, or:  powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "    OK  $text" -ForegroundColor Green }
function Fail($text) { Write-Host "`n    ERROR: $text" -ForegroundColor Red; Read-Host "`nPress Enter to close"; exit 1 }

# Refresh PATH so newly installed programs (node, npm, mongod) are found
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

# ---------------------------------------------------------------- Node.js
Step "Checking Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is not installed. Install it from https://nodejs.org and run this again." }
Ok "Node $(node -v)"

# ---------------------------------------------------------------- PostgreSQL
Step "Finding PostgreSQL"
$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { Fail "PostgreSQL was not found in C:\Program Files\PostgreSQL. Install it first." }
Ok $psql.FullName

$pgPassword = Read-Host "`n    Type the PostgreSQL password you chose during install (press Enter for 'postgres123')"
if ([string]::IsNullOrWhiteSpace($pgPassword)) { $pgPassword = "postgres123" }
$env:PGPASSWORD = $pgPassword

Step "Connecting to PostgreSQL"
$test = & $psql.FullName -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
  Fail "Could not log in to PostgreSQL. Wrong password, or the PostgreSQL service is stopped.`n    Details: $test"
}
Ok "Logged in as postgres"

Step "Creating database 'shopdb'"
$exists = & $psql.FullName -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='shopdb'"
if ($exists -match "1") {
  Ok "shopdb already exists"
} else {
  & $psql.FullName -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE shopdb" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "Could not create database shopdb" }
  Ok "shopdb created"
}

# ---------------------------------------------------------------- MongoDB
Step "Checking MongoDB (port 27017)"
function MongoUp { (Test-NetConnection localhost -Port 27017 -WarningAction SilentlyContinue).TcpTestSucceeded }
if (-not (MongoUp)) {
  $svc = Get-Service MongoDB -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Host "    MongoDB service found but stopped - starting it (needs admin)..."
    Start-Process powershell -Verb RunAs -Wait -ArgumentList "-Command Start-Service MongoDB"
  } else {
    Write-Host "    MongoDB is not installed - installing with winget (click Yes if Windows asks)..."
    winget install -e --id MongoDB.Server --accept-package-agreements --accept-source-agreements
  }
  Start-Sleep -Seconds 5
  if (-not (MongoUp)) {
    Fail "MongoDB is still not running on port 27017. Open 'Services' (services.msc), find 'MongoDB Server', and click Start. Then run this again."
  }
}
Ok "MongoDB is running"

# ---------------------------------------------------------------- .env
Step "Writing backend\.env"
$encoded = [uri]::EscapeDataString($pgPassword)
$secret  = -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
@"
PORT=5000
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgres://postgres:$encoded@localhost:5432/shopdb
MONGO_URL=mongodb://localhost:27017/shopdb

JWT_SECRET=$secret
JWT_EXPIRES_IN=7d
"@ | Set-Content -Path "$root\backend\.env" -Encoding ascii
Ok "backend\.env saved"

# ---------------------------------------------------------------- npm install + seed
Step "Installing backend packages (1-2 minutes)"
Set-Location "$root\backend"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Fail "npm install failed in backend" }

Step "Creating tables and demo data"
npm run seed
if ($LASTEXITCODE -ne 0) { Fail "Seeding failed - see the message above" }

Step "Installing frontend packages (1-2 minutes)"
Set-Location "$root\frontend"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Fail "npm install failed in frontend" }

Set-Location $root
Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  All done!" -ForegroundColor Green
Write-Host "  - In pgAdmin: PostgreSQL 16 > Databases > shopdb > right-click Refresh"
Write-Host "    then Schemas > public > Tables"
Write-Host "  - To run the shop: double-click start.bat"
Write-Host "  - Login: admin@shop.local / admin123"
Write-Host "======================================================" -ForegroundColor Green
Read-Host "`nPress Enter to close"
