. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    Assert-FreePorts @(5173)
    Invoke-Checked 'npm.cmd' @('--prefix', 'frontend/admin-web', 'run', 'dev')
}
