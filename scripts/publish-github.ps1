<#
  Publish to GitHub (PowerShell)
  Usage:
    1) Set environment variables (replace with your info):
       $env:GITHUB_USERNAME = "your-username"
       $env:GITHUB_TOKEN    = "ghp_xxx"   # PAT with repo scope
       $env:REPO_NAME       = "english-shadowing-app"

    2) Run this script from project root:
       pwsh ./scripts/publish-github.ps1

  This script will:
    - Create the repo on GitHub via API (if missing)
    - Add origin remote
    - Push local main branch
#>

param(
  [string]$Visibility = "private"  # private | public
)

function Ensure-Env($name) {
  if (-not $env:$name -or $env:$name.Trim() -eq "") {
    Write-Error "Environment variable '$name' is required."
    exit 1
  }
}

Ensure-Env 'GITHUB_USERNAME'
Ensure-Env 'GITHUB_TOKEN'
Ensure-Env 'REPO_NAME'

$owner = $env:GITHUB_USERNAME
$token = $env:GITHUB_TOKEN
$repo  = $env:REPO_NAME

# Create repo via GitHub API (idempotent)
$headers = @{ Authorization = "token $token"; 'User-Agent' = "publish-script"; Accept = 'application/vnd.github+json' }
$body = @{ name = $repo; private = ($Visibility -eq 'private'); auto_init = $false } | ConvertTo-Json

try {
  $existing = Invoke-RestMethod -Method GET -Uri "https://api.github.com/repos/$owner/$repo" -Headers $headers -ErrorAction SilentlyContinue
  if ($existing) { Write-Host "Repo exists: $owner/$repo" }
  else {
    Write-Host "Creating repo: $owner/$repo ($Visibility)"
    Invoke-RestMethod -Method POST -Uri "https://api.github.com/user/repos" -Headers $headers -Body $body | Out-Null
    Write-Host "Repo created"
  }
} catch {
  Write-Warning "Repo check/create failed (might still exist). Continuing..."
}

# Configure origin remote
$remoteUrl = "https://$token@github.com/$owner/$repo.git"

git remote remove origin 2>$null
git remote add origin $remoteUrl

# Push main branch
git push -u origin main

Write-Host "Pushed to https://github.com/$owner/$repo" -ForegroundColor Green