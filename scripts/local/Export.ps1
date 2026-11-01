param([ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]*$')][string]$Name = 'emulator-data')
. "$PSScriptRoot\Local.Common.ps1"
Invoke-LocalEnvironment {
    Assert-LocalEmulators
    $destination = Join-Path $script:RepositoryRoot ('.local\' + $Name)
    # No --force: replacing an existing export requires the CLI's confirmation.
    Invoke-Firebase emulators:export $destination --config firebase.local.json --project $script:LocalProject
}
