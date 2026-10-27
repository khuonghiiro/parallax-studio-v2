#!/usr/bin/env pwsh
# PowerShell native wrapper for Parallax Studio V2 MCP CLI Controller
# Preserves JSON arguments, unquoted ScriptBlocks {...}, and native Hashtables @{...}
$scriptPath = Join-Path $PSScriptRoot "mcp-server\cli.mjs"
$normArgs = foreach ($a in $args) {
  if ($a -is [scriptblock]) {
    "{$($a.ToString())}"
  } elseif ($a -is [System.Collections.IDictionary]) {
    ($a | ConvertTo-Json -Compress -Depth 10)
  } else {
    [string]$a
  }
}
& node $scriptPath @normArgs
exit $LASTEXITCODE
