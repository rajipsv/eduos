$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { [int]$env:PORT } else { 8888 }
$prefixes = @(
  "http://127.0.0.1:$port/",
  "http://localhost:$port/"
)

$listener = New-Object System.Net.HttpListener
foreach ($prefix in $prefixes) {
  $listener.Prefixes.Add($prefix)
}

try {
  $listener.Start()
} catch {
  Write-Host "Could not bind to port $port. Close other apps using that port and try again."
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "EduOS running at http://127.0.0.1:$port/"
Start-Process "http://127.0.0.1:$port/"

function Get-ContentType($path) {
  switch -Regex ($path) {
    '\.html$' { return 'text/html; charset=utf-8' }
    '\.js$'   { return 'text/javascript; charset=utf-8' }
    '\.css$'  { return 'text/css; charset=utf-8' }
    '\.json$' { return 'application/json; charset=utf-8' }
    default   { return 'application/octet-stream' }
  }
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($context.Request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $file = Join-Path $root ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)

    if (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $file
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $context.Response.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes('Not found')
      $context.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
  } finally {
    $context.Response.Close()
  }
}
