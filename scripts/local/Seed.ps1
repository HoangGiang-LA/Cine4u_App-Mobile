. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    Invoke-Checked 'node' @('Backend/server/tools/seed-local.mjs')
}
