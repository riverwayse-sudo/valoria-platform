$ErrorActionPreference = "Stop"
$Downloads = "$env:USERPROFILE\Downloads"
$Site      = "$Downloads\valoria-site"

# ---------------------------------------------------------------
# PHASE 1: DISCOVERY - show what's sitting in Downloads and what
# component each file actually exports, so you can eyeball the
# mapping before anything gets copied.
# ---------------------------------------------------------------
Write-Host "`n=== Files in Downloads (top level only) and their exported component ===`n"

Get-ChildItem -Path "$Downloads\*" -File -Include *.jsx, *.js | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    $match   = [regex]::Match($content, 'export\s+default\s+function\s+(\w+)')
    $name    = if ($match.Success) { $match.Groups[1].Value } else { "(no 'export default function NAME' found)" }
    Write-Host ("  {0,-28} -> {1}" -f $_.Name, $name)
}

Write-Host "`n=== Deploying ===`n"

# ---------------------------------------------------------------
# PHASE 2: DEPLOY - match by content marker, not filename.
# Skips (does not guess) on zero or multiple matches.
# ---------------------------------------------------------------
function Deploy-ByMarker {
    param(
        [string]$Marker,
        [string]$TargetPath,
        [string]$Label
    )

    $candidates = Get-ChildItem -Path "$Downloads\*" -File -Include *.jsx, *.js | Where-Object {
        Select-String -Path $_.FullName -Pattern $Marker -SimpleMatch -Quiet
    }

    if (-not $candidates -or $candidates.Count -eq 0) {
        Write-Host "[SKIP] $Label - no file in Downloads contains marker '$Marker'" -ForegroundColor Yellow
        return
    }
    if ($candidates.Count -gt 1) {
        Write-Host "[SKIP] $Label - multiple files match marker '$Marker', resolve manually:" -ForegroundColor Yellow
        $candidates | ForEach-Object { Write-Host "    $($_.FullName)" }
        return
    }

    $source = $candidates[0].FullName

    if (Test-Path $TargetPath) {
        Copy-Item $TargetPath "$TargetPath.bak" -Force
        Write-Host "  backed up existing to $TargetPath.bak"
    } else {
        Write-Host "  [WARN] target did not exist yet: $TargetPath" -ForegroundColor Yellow
    }

    Copy-Item $source $TargetPath -Force
    Write-Host "[OK] $Label" -ForegroundColor Green
    Write-Host "  $source  -->  $TargetPath`n"
}

# NOTE: route folder is "develop", not "valoria-develop" - confirmed
# from your `dir /s /b *.jsx` output. This was likely wrong before.
Deploy-ByMarker -Marker "ValoriaDevelopPage" -TargetPath "$Site\src\app\develop\page.jsx"      -Label "develop/page.jsx"
Deploy-ByMarker -Marker "FacilitatorsPage"   -TargetPath "$Site\src\app\facilitators\page.jsx"  -Label "facilitators/page.jsx"

Write-Host "`n=== Done ===`n"
Write-Host "Before committing, sanity-check the dashboard overwrite from the crashed run:"
Write-Host "  cd `"$Site`""
Write-Host "  git diff --stat src/app/dashboard/page.jsx"
Write-Host ""
Write-Host "Then, if everything looks right:"
Write-Host "  git add -A"
Write-Host "  git commit -m `"feat: deploy develop and facilitators pages`""
Write-Host "  git push"
