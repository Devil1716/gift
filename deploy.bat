@echo off
echo ============================================
echo   Gift Day Surprise - Setup ^& Deploy
echo ============================================
echo.

:: Step 1: Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Git is not installed.
    echo.
    echo     Please install Git from: https://git-scm.com/download/win
    echo     After installing, restart this script.
    echo.
    pause
    exit /b 1
)

:: Step 2: Check if gh is installed
where gh >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] GitHub CLI is not installed.
    echo.
    echo     Installing via winget...
    winget install --id GitHub.cli -e --source winget
    if %ERRORLEVEL% neq 0 (
        echo     [!] Auto-install failed. Please install manually:
        echo         https://cli.github.com/
        pause
        exit /b 1
    )
    echo     [OK] GitHub CLI installed. Please restart this script.
    pause
    exit /b 0
)

:: Step 3: Check gh auth
echo [*] Checking GitHub authentication...
gh auth status >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [*] You need to log in to GitHub...
    gh auth login
)

:: Step 4: Initialize git repo
echo.
echo [*] Initializing git repository...
git init
git add .
git commit -m "Initial commit: Gift Day Surprise Website"

:: Step 5: Create GitHub repo and push
echo.
echo [*] Creating GitHub repository...
set /p REPO_NAME="Enter repository name (e.g., gift-for-her): "
gh repo create %REPO_NAME% --public --source=. --remote=origin --push

:: Step 6: Enable GitHub Pages
echo.
echo [*] Enabling GitHub Pages...
timeout /t 5 /nobreak >nul
gh api repos/{owner}/%REPO_NAME%/pages -X POST -f build_type=workflow >nul 2>nul

echo.
echo ============================================
echo   DONE! Your site will be live shortly at:
echo.
for /f "tokens=*" %%a in ('gh api repos/{owner}/%REPO_NAME% --jq .full_name') do set FULL_NAME=%%a
echo   https://%FULL_NAME:*/=%.github.io/%REPO_NAME%/
echo.
echo   It may take 1-2 minutes for the first deploy.
echo   Check progress: gh run list
echo ============================================
pause
