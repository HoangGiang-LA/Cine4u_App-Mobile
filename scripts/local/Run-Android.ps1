param([string]$Serial)
. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    $adbPath = Resolve-AndroidAdb
    $devices = @(& $adbPath devices | Where-Object { $_ -match '^emulator-\d+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if (!$Serial) {
        if ($devices.Count -ne 1) { throw 'Start one Android Emulator, or supply -Serial emulator-XXXX. Physical devices are not configured.' }
        $Serial = $devices[0]
    }
    if ($Serial -notin $devices) { throw 'Select a running Android Emulator; physical devices are not configured.' }
    Push-Location 'frontend'
    try { Invoke-Checked '.\gradlew.bat' @('-PfirebaseEmulators=true', ':app:assembleDebug', '--console=plain') }
    finally { Pop-Location }
    $apkPath = Join-Path $script:RepositoryRoot 'frontend\app\build\outputs\apk\debug\app-debug.apk'
    Invoke-Checked $adbPath @('-s', $Serial, 'install', '-r', $apkPath)
    Invoke-Checked $adbPath @('-s', $Serial, 'shell', 'am', 'start', '-n', 'com.englishbattle.app/.MainActivity')
}
