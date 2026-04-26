param(
    [string]$RemoteUrl = "",
    [switch]$PushBranches
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    git init
    Write-Host "Git repository initialized"
} else {
    Write-Host "Git repository already initialized"
}

git add .

# Create first commit only when repository has no commits.
$hasCommits = $true
try {
    git rev-parse --verify HEAD *> $null
} catch {
    $hasCommits = $false
}

if (-not $hasCommits) {
    git commit -m "chore: initial project import"
    Write-Host "Initial commit created"
}

# Ensure main branch exists.
$branchName = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branchName -ne "main") {
    git branch -M main
}

# Ensure develop branch exists.
$developExists = (git branch --list develop)
if (-not $developExists) {
    git checkout -b develop
    git checkout main
}

if ($RemoteUrl -ne "") {
    $remoteExists = (git remote | Select-String -SimpleMatch "origin")
    if (-not $remoteExists) {
        git remote add origin $RemoteUrl
        Write-Host "Remote origin added: $RemoteUrl"
    } else {
        Write-Host "Remote origin already exists"
    }
}

if ($PushBranches -and $RemoteUrl -ne "") {
    git push -u origin main
    git push -u origin develop
    Write-Host "Pushed main and develop branches"
}

Write-Host "Git setup finished"
