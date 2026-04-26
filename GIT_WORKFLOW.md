# Git workflow for ArenaReserve

This document implements the assignment part for version control using Git.

## 1) Initialize repository (one-time)

Run in project root:

git init
git add .
git commit -m "chore: initial project import"

Optional: connect remote repository

git remote add origin https://github.com/<org-or-user>/ArenaRevers-main.git
git branch -M main
git push -u origin main

PowerShell shortcut from this project:

powershell -ExecutionPolicy Bypass -File .\git-init.ps1

With remote and auto-push:

powershell -ExecutionPolicy Bypass -File .\git-init.ps1 -RemoteUrl https://github.com/<org-or-user>/ArenaRevers-main.git -PushBranches

## 2) Branch strategy

- `main`: stable production-ready code.
- `develop`: integration branch for upcoming release.
- `feature/*`: task branches (example: `feature/ansible-deploy`).
- `hotfix/*`: emergency fixes from main.

Create integration branches:

git checkout -b develop
git push -u origin develop

## 3) Daily development flow

Start a feature:

git checkout develop
git pull origin develop
git checkout -b feature/<short-task-name>

Commit with clear messages:

git add <files>
git commit -m "feat: add ansible deploy playbook"

Publish branch:

git push -u origin feature/<short-task-name>

After review, merge to develop, then periodically merge develop to main.

## 4) Recommended commit prefixes

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code changes without behavior changes
- `chore:` maintenance

## 5) Minimum commands for report/demo

git branch
git log --oneline --decorate --graph -n 20
git status

These commands are usually enough to show version-control usage in coursework.
