param([switch]$Browser)
. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    Invoke-Checked 'node' @('--test', '--test-concurrency=1', '--test-timeout=120000', 'Backend/server/test/local.integration.test.mjs')
    if ($Browser) {
        $oldBrowserPath = $env:PLAYWRIGHT_BROWSERS_PATH
        if (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot '.local\playwright')) {
            $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $script:RepositoryRoot '.local\playwright'
        }
        Push-Location 'frontend/admin-web'
        try { Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.local.config.ts') }
        finally { Pop-Location; $env:PLAYWRIGHT_BROWSERS_PATH = $oldBrowserPath }
    }
}
