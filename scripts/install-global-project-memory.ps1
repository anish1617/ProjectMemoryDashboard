param([string]$DestinationRoot = $env:USERPROFILE)

$ErrorActionPreference = 'Stop'
$taskSource = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../skills/project-memory'))
$taskProfile = [System.IO.Path]::GetFullPath($DestinationRoot)
$taskFiles = @('SKILL.md', 'agents/openai.yaml')
$taskTargets = @(
    (Join-Path $taskProfile '.agents/skills/project-memory'),
    (Join-Path $taskProfile '.claude/skills/project-memory')
)

# Inspect every target first; preserve an existing different skill rather than overwrite it.
foreach ($taskTarget in $taskTargets) {
    foreach ($taskFile in $taskFiles) {
        $taskOrigin = Join-Path $taskSource $taskFile
        if (-not (Test-Path -LiteralPath $taskOrigin -PathType Leaf)) {
            throw "Missing skill source: $taskFile"
        }
        $taskDestination = Join-Path $taskTarget $taskFile
        if (Test-Path -LiteralPath $taskDestination) {
            if (-not (Test-Path -LiteralPath $taskDestination -PathType Leaf)) {
                throw "Skill destination is not a file: $taskDestination"
            }
            if ((Get-FileHash -LiteralPath $taskOrigin).Hash -ne (Get-FileHash -LiteralPath $taskDestination).Hash) {
                throw "Existing skill differs; review it before updating: $taskDestination"
            }
        }
    }
}

foreach ($taskTarget in $taskTargets) {
    foreach ($taskFile in $taskFiles) {
        $taskDestination = Join-Path $taskTarget $taskFile
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $taskDestination) | Out-Null
        if (-not (Test-Path -LiteralPath $taskDestination)) {
            Copy-Item -LiteralPath (Join-Path $taskSource $taskFile) -Destination $taskDestination
        }
    }
    Write-Output "Installed/verified: $taskTarget"
}
