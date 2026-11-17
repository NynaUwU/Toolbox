<#
    Update-Windows.ps1
    ------------------
    - Installs ALL available updates (Windows Update + Microsoft Update)
    - Reboots and resumes by itself until nothing is left
    - Windows 10: pins the PC to Windows 10 22H2 and skips any "Windows 11" upgrade
                  (normal Windows 10 updates keep working)
    - Windows 11: installs everything normally
    - When finished: cleans the update cache (downloads + Delivery Optimization)
    Log file: C:\ProgramData\WinUpdateHelper\update-log.txt
#>
param([switch]$Resume)

$WorkDir   = 'C:\ProgramData\WinUpdateHelper'
$Script    = Join-Path $WorkDir 'Update-Windows.ps1'
$RoundFile = Join-Path $WorkDir 'round.txt'
$LogFile   = Join-Path $WorkDir 'update-log.txt'
$TaskName  = 'WinUpdateHelper-Resume'
$MaxRounds = 15   # safety limit so it never loops forever

# ---------- 1. Run as Administrator ----------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Resume) { $argList += ' -Resume' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
    exit
}

# Keep a copy in a fixed place so the resume-after-reboot task always finds it
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
if ($PSCommandPath -ne $Script) { Copy-Item -Path $PSCommandPath -Destination $Script -Force }

Start-Transcript -Path $LogFile -Append | Out-Null

function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Info($msg)  { Write-Host "    $msg" -ForegroundColor Gray }
function Warn($msg)  { Write-Host "    $msg" -ForegroundColor Yellow }

function Finish($msg, $color = 'Green') {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Remove-Item $RoundFile -Force -ErrorAction SilentlyContinue
    Write-Host "`n$msg" -ForegroundColor $color
    Stop-Transcript | Out-Null
    Read-Host "`nPress Enter to close"
    exit
}

function Clear-UpdateCache {
    Step 'Cleaning the update cache'

    # 1. Downloaded update files (SoftwareDistribution\Download)
    Info 'Stopping update services...'
    foreach ($s in 'wuauserv', 'bits', 'dosvc') {
        Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
    }
    $dl = 'C:\Windows\SoftwareDistribution\Download'
    if (Test-Path $dl) {
        $before = (Get-ChildItem $dl -Recurse -Force -ErrorAction SilentlyContinue |
                   Measure-Object -Property Length -Sum).Sum
        Get-ChildItem $dl -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Info ("Removed downloaded updates: {0:N0} MB" -f ($before / 1MB))
    }

    # 2. Delivery Optimization cache (peer-to-peer update cache)
    Start-Service -Name dosvc -ErrorAction SilentlyContinue
    try {
        Delete-DeliveryOptimizationCache -Force -ErrorAction Stop
        Info 'Delivery Optimization cache cleared'
    } catch {
        Info 'Delivery Optimization cache: skipped'
    }

    foreach ($s in 'bits', 'wuauserv') { Start-Service -Name $s -ErrorAction SilentlyContinue }
}

function Test-PendingReboot {
    $wu  = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
    $cbs = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
    $ps  = $false
    try { $ps = [bool](Get-WURebootStatus -Silent -ErrorAction Stop) } catch {}
    return ($wu -or $cbs -or $ps)
}

function Restart-AndResume {
    Step 'Reboot needed - scheduling the script to continue after you log in'
    $user      = "$env:USERDOMAIN\$env:USERNAME"
    $action    = New-ScheduledTaskAction -Execute 'powershell.exe' `
                 -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`" -Resume"
    $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
    $trigger.Delay = 'PT30S'
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                 -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null

    Warn 'Restarting in 30 seconds... (to cancel: open cmd and type  shutdown /a )'
    Stop-Transcript | Out-Null
    shutdown.exe /r /t 30 /c "Windows updates: restarting to continue installation"
    exit
}

# ---------- 2. Round counter ----------
if (-not $Resume) { Set-Content -Path $RoundFile -Value 0 }

# ---------- 3. Detect Windows version ----------
$cv      = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$build   = [int]$cv.CurrentBuildNumber
$isWin11 = $build -ge 22000
$edition = $cv.EditionID
Step "Detected: Windows $(if ($isWin11) {'11'} else {'10'}) $($cv.DisplayVersion) (build $build, edition $edition)"

# ---------- 4. Windows 10: stay on Windows 10 ----------
$updateFilter = @{ MicrosoftUpdate = $true }
if (-not $isWin11) {
    Step 'Pinning this PC to Windows 10 22H2 (blocks the Windows 11 upgrade only)'
    $p = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
    if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
    Set-ItemProperty -Path $p -Name TargetReleaseVersion     -Value 1            -Type DWord
    Set-ItemProperty -Path $p -Name ProductVersion           -Value 'Windows 10' -Type String
    Set-ItemProperty -Path $p -Name TargetReleaseVersionInfo -Value '22H2'       -Type String
    if ($edition -like 'Core*') {
        Warn 'Home edition: Windows may ignore the pin, but this script still skips Windows 11 by name.'
    }
    # Extra safety: never install anything with "Windows 11" in its title
    $updateFilter.NotTitle = 'Windows 11'
}

# ---------- 5. Make sure update services are running ----------
Step 'Checking Windows Update services'
foreach ($s in 'wuauserv', 'bits', 'cryptsvc') {
    $svc = Get-Service -Name $s -ErrorAction SilentlyContinue
    if ($svc -and $svc.StartType -eq 'Disabled') {
        Set-Service -Name $s -StartupType Manual
        Info "$s was disabled - set to Manual"
    }
    Start-Service -Name $s -ErrorAction SilentlyContinue
}

# ---------- 6. Install / load PSWindowsUpdate ----------
Step 'Loading PSWindowsUpdate module'
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    if (-not (Get-Module -ListAvailable -Name PSWindowsUpdate)) {
        Info 'Not installed - installing...'
        if (-not (Get-PackageProvider -ListAvailable -Name NuGet -ErrorAction SilentlyContinue)) {
            Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null
        }
        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
        Install-Module -Name PSWindowsUpdate -Force -Scope AllUsers -ErrorAction Stop
    }
    Import-Module PSWindowsUpdate -Force -ErrorAction Stop
} catch {
    Finish "Could not load PSWindowsUpdate: $($_.Exception.Message)" 'Red'
}
try { Add-WUServiceManager -MicrosoftUpdate -Confirm:$false -ErrorAction Stop | Out-Null } catch {}

# ---------- 7. Update loop ----------
while ($true) {
    $round = [int](Get-Content $RoundFile -ErrorAction SilentlyContinue) + 1
    Set-Content -Path $RoundFile -Value $round
    if ($round -gt $MaxRounds) {
        Finish "Stopped after $MaxRounds rounds - some update keeps failing. Check $LogFile" 'Yellow'
    }

    Step "Round $round - scanning for updates (this can take several minutes)"
    $list = @(Get-WindowsUpdate @updateFilter)

    if ($list.Count -eq 0) {
        if (Test-PendingReboot) { Restart-AndResume }
        Clear-UpdateCache
        Finish 'All done - no more updates available, cache cleaned.'
    }

    Info "Found $($list.Count) update(s):"
    $list | ForEach-Object { Info " - $($_.KB)  $($_.Title)" }

    Step 'Installing'
    Install-WindowsUpdate @updateFilter -AcceptAll -IgnoreReboot -Verbose | Out-Host

    if (Test-PendingReboot) { Restart-AndResume }
    # No reboot needed -> scan again right away (new updates may appear now)
}
