param(
    [string]$SeedPath = (Join-Path $PSScriptRoot '../../Backend/database/english-battle.seed.json')
)
$ErrorActionPreference = 'Stop'
$seedData = Get-Content -LiteralPath $SeedPath -Raw | ConvertFrom-Json
$questions = foreach ($entry in $seedData.questions.PSObject.Properties) {
    $metadata = $entry.Value
    $version = $seedData.questionVersions.($entry.Name).v1
    $answer = $seedData.questionAnswers.($entry.Name).v1
    [ordered]@{
        id = $entry.Name
        version = 'v1'
        categoryId = $metadata.categoryId
        topicId = $metadata.topicId
        prompt = $version.prompt
        passage = [string]$version.passage
        audioText = if ($version.audioAssetId) { [string]$seedData.contentAssets.($version.audioAssetId).speechText } else { '' }
        options = @($version.options.PSObject.Properties | Sort-Object { $_.Value.order } | ForEach-Object {
            [ordered]@{ id = $_.Name; text = $_.Value.text }
        })
        correctId = $answer.correctOptionId
        explanation = $answer.explanation
    }
}
$demoContent = [ordered]@{
    categories = @($seedData.categories.PSObject.Properties | ForEach-Object {
        [ordered]@{ id = $_.Name; name = $_.Value.name; order = $_.Value.sortOrder }
    })
    topics = @($seedData.topics.PSObject.Properties | ForEach-Object {
        [ordered]@{ id = $_.Name; categoryId = $_.Value.categoryId; title = $_.Value.title; order = $_.Value.sortOrder; target = $_.Value.completionTarget }
    })
    questions = @($questions)
}
$outputDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../app/src/debug/assets'))
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputPath = Join-Path $outputDirectory 'demo-content.json'
$demoContent | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Output "Generated $($questions.Count) debug-only questions: $outputPath"
