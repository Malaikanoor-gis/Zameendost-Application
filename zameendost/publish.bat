@echo off
rem ZameenDost - publish this folder to GitHub Pages.
rem Run it from CMD by typing:  publish   (then Enter).  The first run uploads everything; later runs upload your changes.
setlocal EnableExtensions
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 goto nogit

if exist ".git" goto update

rem ------------------------------------------------------------------ first time
echo.
echo  ============================================================
echo   ZameenDost - FIRST-TIME PUBLISH
echo  ============================================================
echo.
echo  Before you continue, you must already have:
echo    1. a GitHub account, and
echo    2. an EMPTY public repository named  zameendost
echo       (create it at https://github.com/new and tick nothing).
echo.
set "GHUSER="
set /p GHUSER= Type your GitHub username and press Enter:
if "%GHUSER%"=="" goto nouser

echo.
echo  Your commits will be public and will show this name and email:
git config user.name
git config user.email
echo.
echo  If that is fine, press a key to continue. To stop, close this window now.
pause >nul

git init -b main
if errorlevel 1 goto fail
git add .
if errorlevel 1 goto fail
git commit -m "ZameenDost: satellite-based irrigation advisory"
if errorlevel 1 goto fail
git remote add origin https://github.com/%GHUSER%/zameendost.git
if errorlevel 1 goto fail

echo.
echo  Uploading. A GitHub sign-in window may open - sign in there.
echo.
git push -u origin main
if errorlevel 1 goto pushfail

echo.
echo  ============================================================
echo   UPLOADED. One last step, done once, on the GitHub website:
echo  ============================================================
echo.
echo   Open:    https://github.com/%GHUSER%/zameendost/settings/pages
echo   Source:  Deploy from a branch
echo   Branch:  main      Folder:  / (root)      then click Save
echo.
echo   A minute or two later your app is live at:
echo.
echo      https://%GHUSER%.github.io/zameendost/
echo.
pause
exit /b 0

rem ------------------------------------------------------------------ later runs
:update
echo.
echo  ============================================================
echo   ZameenDost - UPLOADING YOUR CHANGES
echo  ============================================================
echo.
echo  Publishing to:
git remote get-url origin
echo.
git add .
if errorlevel 1 goto fail
git commit -m "Update ZameenDost"
rem "nothing to commit" is not an error here - there may still be something to upload.
git push -u origin main
if errorlevel 1 goto pushfail
echo.
echo  DONE. The website updates in a minute or two.
echo  If you still see the old version, refresh the page with Ctrl+Shift+R.
echo.
pause
exit /b 0

rem ------------------------------------------------------------------ problems
:nogit
echo.
echo  Git is not installed on this computer.
echo  Download it from https://git-scm.com/download/win , install it, then run this again.
echo.
pause
exit /b 1

:nouser
echo.
echo  No username was typed, so nothing was done. Run this again when you are ready.
echo.
pause
exit /b 1

:pushfail
echo.
echo  The upload did not go through. Read the message above. The usual causes:
echo.
echo   - The repository does not exist yet. Create it at https://github.com/new
echo     (name: zameendost, Public, tick nothing), then run this again.
echo   - The username was typed wrong. Fix it with this command, then run this again:
echo        git remote set-url origin https://github.com/RIGHT-USERNAME/zameendost.git
echo   - The sign-in window was closed. Run this again and sign in.
echo   - No internet connection.
echo.
pause
exit /b 1

:fail
echo.
echo  Something went wrong. Read the message above.
echo  Nothing was uploaded.
echo.
pause
exit /b 1
