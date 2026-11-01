param([switch]$Browser, [switch]$CheckOnly)
. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    $nodeVersion = & node -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.Split('.')[0]) -ne 24) { throw 'Install Node.js 24 LTS (Functions runtime).' }
    Invoke-Checked 'java' @('-version')
    Invoke-Firebase --version
    if (!$CheckOnly) {
        foreach ($module in @('Backend/functions', 'Backend/server', 'frontend/admin-web')) {
            Invoke-Checked 'npm.cmd' @('--prefix', $module, 'ci')
        }
        Invoke-Checked 'npm.cmd' @('--prefix', 'Backend/functions', 'run', 'build')
        if ($Browser) {
            $oldBrowserPath = $env:PLAYWRIGHT_BROWSERS_PATH
            $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $script:RepositoryRoot '.local\playwright'
            try {
                Push-Location 'frontend/admin-web'
                Invoke-Checked 'npx.cmd' @('playwright', 'install', 'chromium')
            } finally { Pop-Location; $env:PLAYWRIGHT_BROWSERS_PATH = $oldBrowserPath }
        }
    }
    Write-Host 'Local setup ready. See docs/LOCAL-EMULATOR.md for the four terminal commands.'
}
