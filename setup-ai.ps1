# Run from the ai-daily-life-assistant folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-ai.ps1
$ProjectRef = "yoahgqalgminfzpdpepo"

function Step($name, [scriptblock]$cmd) {
  Write-Host ""
  Write-Host "== $name ==" -ForegroundColor Cyan
  & $cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED at step: $name" -ForegroundColor Red
    Write-Host "Copy the red/white text above this line and send it to Claude. It does not contain your key."
    exit 1
  }
}

Write-Host "== 1. Checking folder ==" -ForegroundColor Cyan
if (-not (Test-Path "supabase\functions\ai-chat\index.ts")) {
  Write-Host "FAILED: run this script from inside the ai-daily-life-assistant folder (supabase\functions\ai-chat\index.ts not found)." -ForegroundColor Red
  exit 1
}
Write-Host "Folder OK."

Write-Host ""
Write-Host "== 2. Testing your Gemini key with Google ==" -ForegroundColor Cyan
$sec = Read-Host "Paste your NEW Gemini key (it stays hidden)" -AsSecureString
$K = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$body = '{"contents":[{"parts":[{"text":"Say hi in three words"}]}]}'
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent" -Headers @{ "x-goog-api-key" = $K } -ContentType "application/json" -Body $body
  Write-Host ("Key works. Gemini said: " + $r.candidates[0].content.parts[0].text) -ForegroundColor Green
} catch {
  Write-Host "FAILED at step: key test" -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  Write-Host "Send this error text to Claude. It does not contain your key."
  exit 1
}

Step "3. Supabase login (a browser window will open)" { npx supabase login }
Step "4. Linking project" { npx supabase link --project-ref $ProjectRef }
Step "5. Storing the key as a Supabase secret" { npx supabase secrets set "GEMINI_API_KEY=$K" }
Step "6. Deploying the ai-chat function" { npx supabase functions deploy ai-chat --no-verify-jwt }

$K = $null
Write-Host ""
Write-Host "ALL STEPS DONE." -ForegroundColor Green
Write-Host "Now: (a) run 002_ai_usage.sql in the Supabase SQL Editor if you have not yet, (b) open the app, Assistant, ask: Plan my day."
