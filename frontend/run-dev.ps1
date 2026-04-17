$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path $node)) {
  throw "Bundled Node runtime not found at $node"
}

& $node ".\node_modules\vite\bin\vite.js"
exit $LASTEXITCODE
