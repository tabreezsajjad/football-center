$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$bundleRoot = Join-Path $projectRoot "artifacts/backend-$stamp"
$zipPath = "$bundleRoot.zip"
if (Test-Path -LiteralPath $bundleRoot) { throw 'Package destination already exists.' }

$files = @(
    'netlify.toml', 'DEPLOYMENT.md', 'NETLIFY.md', '.gitignore',
    'package.json', 'package-lock.json', 'netlify/functions/api.js', 'public/index.html',
    'server/netlify-handler.js',
    'server/package.json', 'server/package-lock.json', 'server/.env.example',
    'server/index.js', 'server/app.js', 'server/clubs.js',
    'server/football-data.js', 'server/cup-fixtures.js', 'server/india-broadcasts.js',
    'server/nodemon.json', 'shared/crests.js'
)
foreach ($relativePath in $files) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing source: $relativePath" }
}
foreach ($relativePath in $files) {
    $source = Join-Path $projectRoot $relativePath
    $destination = Join-Path $bundleRoot $relativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}
Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $zipPath
Write-Output "Upload folder contents: $bundleRoot"
Write-Output "Backend ZIP: $zipPath"
