. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    Assert-FreePorts @(8080)
    # Deliberately bypass npm start's .env loader: never load production credentials.
    Invoke-Checked 'node' @('Backend/server/src/index.mjs')
}
