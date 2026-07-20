@echo off
REM Run this from C:\Users\FEMI\Downloads after downloading the new page.jsx
REM into that same Downloads folder. It replaces the broken feedback page
REM (missing Suspense boundary around useSearchParams, which fails the
REM Next.js production build) with the fixed version.

set REPO=C:\Users\FEMI\Downloads\valoria-site

if not exist "%REPO%" (
  echo Could not find %REPO% — edit the REPO path at the top of this script and re-run.
  pause
  exit /b 1
)

echo Replacing src\app\feedback\page.jsx...
copy /Y "%~dp0page.jsx" "%REPO%\src\app\feedback\page.jsx"

echo.
echo Done. Next steps:
echo   cd %REPO%
echo   git add src\app\feedback\page.jsx
echo   git commit -m "fix: wrap useSearchParams in Suspense boundary (was failing prod build)"
echo   git push
echo.
pause
