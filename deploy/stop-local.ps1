$log = Join-Path $PSScriptRoot 'stop-local.log'
"=== stop local bot $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8

schtasks /delete /tn "Discord Ticket Bot" /f *>&1 | Out-File $log -Append -Encoding utf8
"delete-exit=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8

$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object {
  $_.CommandLine -like '*discord-ticket-bot*index.js*'
}
foreach ($p in $procs) {
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    "killed pid=$($p.ProcessId)" | Out-File $log -Append -Encoding utf8
  } catch {
    "kill failed pid=$($p.ProcessId): $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
  }
}
"done" | Out-File $log -Append -Encoding utf8
