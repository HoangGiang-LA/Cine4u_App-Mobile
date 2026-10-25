$ErrorActionPreference = 'Stop'
$adminSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../../Backend/database/english-battle.seed.json') -Raw | ConvertFrom-Json
$adminDemo = [ordered]@{ topics = [ordered]@{}; lessons = [ordered]@{}; questions = [ordered]@{}; questionVersions = [ordered]@{}; questionAnswers = [ordered]@{}; contentAssets = [ordered]@{} }
foreach ($entry in $adminSource.topics.psobject.Properties) {
    $adminDemo.topics[$entry.Name] = $entry.Value | Select-Object categoryId, title
}
foreach ($entry in $adminSource.lessons.psobject.Properties) {
    $adminDemo.lessons[$entry.Name] = $entry.Value | Select-Object topicId, title, description, difficulty
}
foreach ($entry in $adminSource.questions.psobject.Properties) {
    $adminDemo.questions[$entry.Name] = $entry.Value | Select-Object displayCode, categoryId, topicId, lessonId, difficulty, currentVersion
    $adminDemo.questionVersions[$entry.Name] = [ordered]@{}
    $adminDemo.questionAnswers[$entry.Name] = [ordered]@{}
    foreach ($version in $adminSource.questionVersions.($entry.Name).psobject.Properties) {
        $adminDemo.questionVersions[$entry.Name][$version.Name] = $version.Value | Select-Object prompt, options, passage, audioAssetId
        $adminDemo.questionAnswers[$entry.Name][$version.Name] = $adminSource.questionAnswers.($entry.Name).($version.Name) | Select-Object correctOptionId, explanation
    }
}
foreach ($entry in $adminSource.contentAssets.psobject.Properties) {
    $adminDemo.contentAssets[$entry.Name] = $entry.Value | Select-Object speechText
}
$adminDemo | ConvertTo-Json -Depth 25 -Compress | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../src/data/content-seed.json') -Encoding utf8
Write-Output ('Refreshed {0} public starter questions for the local admin demo.' -f $adminDemo.questions.Count)
