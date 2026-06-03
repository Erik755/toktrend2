$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:TOKTREND_PORT) { [int]$env:TOKTREND_PORT } else { 8789 }
$Prefix = "http://127.0.0.1:$Port/"

function Read-DotEnv {
    param([string]$Path)
    $envMap = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $envMap }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
        $parts = $line.Split("=", 2)
        $envMap[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }

    return $envMap
}

function Test-ConfiguredValue {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
    $clean = $Value.Trim()
    if ($clean -match '^(MY_|YOUR_|pon_tu|tu_clave|replace_|example_|xxxxx)') { return $false }
    if ($clean -match '_aqui$') { return $false }
    return $true
}

function Send-Json {
    param($Context, [int]$StatusCode, $Object)

    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "application/json; charset=utf-8"
    $Context.Response.Headers["Access-Control-Allow-Origin"] = "*"
    $Context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $Context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type"

    $json = $Object | ConvertTo-Json -Depth 40
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Send-File {
    param($Context, [string]$Path)

    $mime = @{
        ".html" = "text/html; charset=utf-8"
        ".css" = "text/css; charset=utf-8"
        ".js" = "application/javascript; charset=utf-8"
        ".png" = "image/png"
        ".webp" = "image/webp"
        ".svg" = "image/svg+xml"
        ".xml" = "application/xml; charset=utf-8"
    }

    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    $Context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Read-RequestBody {
    param($Request)

    $reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
    try { return $reader.ReadToEnd() } finally { $reader.Close() }
}

function Send-Html {
    param($Context, [int]$StatusCode, [string]$Html)

    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "text/html; charset=utf-8"
    $Context.Response.Headers["Access-Control-Allow-Origin"] = "*"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Html)
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Send-Redirect {
    param($Context, [string]$Location)

    $Context.Response.StatusCode = 302
    $Context.Response.Headers["Location"] = $Location
    $Context.Response.Close()
}

function Get-RemoteErrorBody {
    param($ErrorRecord)

    try {
        if ($ErrorRecord.Exception.Response) {
            $stream = $ErrorRecord.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = [System.IO.StreamReader]::new($stream)
                try { return $reader.ReadToEnd() } finally { $reader.Close() }
            }
        }
    } catch {
        return ""
    }

    return ""
}

function Write-RemoteErrorLog {
    param(
        [string]$Label,
        $ErrorRecord
    )

    Write-Host "================ $Label ================" -ForegroundColor Red
    Write-Host $ErrorRecord.Exception.Message -ForegroundColor Red

    $body = Get-RemoteErrorBody -ErrorRecord $ErrorRecord
    if ($body) {
        Write-Host "Respuesta remota:" -ForegroundColor Yellow
        Write-Host $body -ForegroundColor Yellow
    } else {
        Write-Host "Sin cuerpo de respuesta remoto." -ForegroundColor DarkYellow
    }

    Write-Host "========================================" -ForegroundColor Red
}

function Get-TikTokClientConfig {
    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $clientKey = [string]$envMap["TIKTOK_CLIENT_KEY"]
    $clientSecret = [string]$envMap["TIKTOK_CLIENT_SECRET"]
    $redirectUri = if (Test-ConfiguredValue -Value ([string]$envMap["TIKTOK_REDIRECT_URI"])) {
        [string]$envMap["TIKTOK_REDIRECT_URI"]
    } else {
        "http://127.0.0.1:$Port/api/tiktok/oauth/callback"
    }
    $scopes = if (Test-ConfiguredValue -Value ([string]$envMap["TIKTOK_SCOPES"])) {
        [string]$envMap["TIKTOK_SCOPES"]
    } else {
        "user.info.basic,video.publish"
    }

    return @{
        clientKey = $clientKey
        clientSecret = $clientSecret
        redirectUri = $redirectUri
        scopes = $scopes
        configured = ((Test-ConfiguredValue -Value $clientKey) -and (Test-ConfiguredValue -Value $clientSecret))
    }
}

function Get-TikTokTokenPath {
    return (Join-Path $Root ".tiktok_token.json")
}

function Get-TikTokOAuthStatePath {
    return (Join-Path $Root ".tiktok_oauth_state.json")
}

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-PkceVerifier {
    $bytes = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return ConvertTo-Base64Url -Bytes $bytes
}

function Get-PkceChallenge {
    param([string]$Verifier)

    $bytes = [System.Text.Encoding]::ASCII.GetBytes($Verifier)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($bytes)
    } finally {
        $sha.Dispose()
    }
    return ConvertTo-Base64Url -Bytes $hash
}

function Save-TikTokOAuthState {
    param([string]$State, [string]$CodeVerifier)

    @{
        state = $State
        codeVerifier = $CodeVerifier
        createdAt = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Get-TikTokOAuthStatePath) -Encoding UTF8
}

function Get-TikTokOAuthState {
    param([string]$State)

    $path = Get-TikTokOAuthStatePath
    if (-not (Test-Path -LiteralPath $path)) { return $null }

    try {
        $saved = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        if ([string]$saved.state -ne $State) { return $null }
        return $saved
    } catch {
        return $null
    }
}

function Save-TikTokToken {
    param($TokenResponse)

    $now = Get-Date
    $expiresIn = if ($TokenResponse.expires_in) { [int]$TokenResponse.expires_in } else { 0 }
    $refreshExpiresIn = if ($TokenResponse.refresh_expires_in) { [int]$TokenResponse.refresh_expires_in } else { 0 }

    $tokenObject = @{
        access_token = [string]$TokenResponse.access_token
        refresh_token = [string]$TokenResponse.refresh_token
        open_id = [string]$TokenResponse.open_id
        scope = [string]$TokenResponse.scope
        token_type = [string]$TokenResponse.token_type
        expires_in = $expiresIn
        refresh_expires_in = $refreshExpiresIn
        created_at = $now.ToString("o")
        expires_at = $(if ($expiresIn -gt 0) { $now.AddSeconds([Math]::Max(60, $expiresIn - 120)).ToString("o") } else { "" })
        refresh_expires_at = $(if ($refreshExpiresIn -gt 0) { $now.AddSeconds([Math]::Max(60, $refreshExpiresIn - 120)).ToString("o") } else { "" })
    }

    $tokenObject | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Get-TikTokTokenPath) -Encoding UTF8
    return $tokenObject
}

function Get-TikTokSavedToken {
    $path = Get-TikTokTokenPath
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } catch { return $null }
}

function Invoke-TikTokTokenRequest {
    param($Body)

    try {
        return Invoke-RestMethod -Method Post -Uri "https://open.tiktokapis.com/v2/oauth/token/" -ContentType "application/x-www-form-urlencoded" -Body $Body
    } catch {
        Write-RemoteErrorLog -Label "ERROR TIKTOK oauth_token" -ErrorRecord $_
        throw
    }
}

function Invoke-TikTokExchangeCode {
    param([string]$Code, [string]$CodeVerifier)

    $config = Get-TikTokClientConfig
    if (-not $config.configured) { throw "Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en .env." }

    $response = Invoke-TikTokTokenRequest -Body @{
        client_key = $config.clientKey
        client_secret = $config.clientSecret
        code = $Code
        code_verifier = $CodeVerifier
        grant_type = "authorization_code"
        redirect_uri = $config.redirectUri
    }

    return Save-TikTokToken -TokenResponse $response
}

function Invoke-TikTokRefreshToken {
    param([string]$RefreshToken)

    $config = Get-TikTokClientConfig
    if (-not $config.configured) { throw "Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en .env." }
    if (-not (Test-ConfiguredValue -Value $RefreshToken)) { throw "No hay refresh token valido de TikTok." }

    $response = Invoke-TikTokTokenRequest -Body @{
        client_key = $config.clientKey
        client_secret = $config.clientSecret
        grant_type = "refresh_token"
        refresh_token = $RefreshToken
    }

    return Save-TikTokToken -TokenResponse $response
}

function New-TikTokAuthorizationUrl {
    $config = Get-TikTokClientConfig
    if (-not $config.configured) { throw "Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en .env." }

    $state = [Guid]::NewGuid().ToString("N")
    $codeVerifier = New-PkceVerifier
    $codeChallenge = Get-PkceChallenge -Verifier $codeVerifier
    Save-TikTokOAuthState -State $state -CodeVerifier $codeVerifier

    $query = "client_key=$([System.Net.WebUtility]::UrlEncode($config.clientKey))" +
        "&response_type=code" +
        "&scope=$([System.Net.WebUtility]::UrlEncode($config.scopes))" +
        "&redirect_uri=$([System.Net.WebUtility]::UrlEncode($config.redirectUri))" +
        "&state=$([System.Net.WebUtility]::UrlEncode($state))" +
        "&code_challenge=$([System.Net.WebUtility]::UrlEncode($codeChallenge))" +
        "&code_challenge_method=S256"

    return "https://www.tiktok.com/v2/auth/authorize/?$query"
}

function Get-TikTokConnectionStatus {
    $config = Get-TikTokClientConfig
    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $manualToken = [string]$envMap["TIKTOK_ACCESS_TOKEN"]
    $token = Get-TikTokSavedToken
    $connected = $false
    $expiresAt = ""

    if (Test-ConfiguredValue -Value $manualToken) {
        $connected = $true
        $expiresAt = "manual-token"
    } elseif ($token -and (Test-ConfiguredValue -Value ([string]$token.access_token))) {
        $expiresAt = [string]$token.expires_at
        if (-not $expiresAt) {
            $connected = $true
        } else {
            try { $connected = ([DateTime]::Parse($expiresAt) -gt (Get-Date).AddMinutes(5)) } catch { $connected = $true }
        }
    }

    return @{
        configured = $config.configured
        connected = $connected
        redirectUri = $config.redirectUri
        scopes = $config.scopes
        tokenExpiresAt = $expiresAt
    }
}

function Format-LearningNotes {
    param($Notes)

    if (-not $Notes) { return "Sin aprendizaje previo." }

    $items = @()
    foreach ($note in @($Notes)) {
        if ($null -eq $note) { continue }

        if ($note -is [string]) {
            if (-not [string]::IsNullOrWhiteSpace($note)) { $items += $note.Trim() }
            continue
        }

        $summary = ""
        if ($note.PSObject.Properties["summary"]) { $summary = [string]$note.summary }

        $suggestionsText = ""
        if ($note.PSObject.Properties["suggestions"] -and $note.suggestions) {
            $suggestionsText = (@($note.suggestions) | Select-Object -First 3) -join " / "
        }

        $line = (($summary, $suggestionsText) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join " Sugerencias: "
        if (-not [string]::IsNullOrWhiteSpace($line)) { $items += $line }
    }

    if (-not $items.Count) { return "Sin aprendizaje previo." }
    return ($items | Select-Object -First 8) -join " | "
}

function Get-AgentGuidance {
@"
Guia interna derivada de agency-agents:
- TikTok Strategist: gancho en 3 segundos, formato vertical movil, integracion de trends, 5 a 8 hashtags y llamada a comentarios.
- Short-Video Editing Coach: cada escena debe justificar su lugar, cortes rapidos, texto en zona segura, voz clara, tono suave y ritmo sin pausas muertas.
- Video Optimization Specialist: prioriza retencion, curiosidad honesta, payoff rapido, una sola idea principal y cierre que pida feedback util.
- Feedback Synthesizer: convierte comentarios en temas accionables, detecta confusion, falta de relevancia y sugerencias repetidas para corregir el siguiente video.
- Autonomous Optimization Architect: usa proveedor principal, fallback y errores explicables sin detener el flujo local.
"@
}

function Build-Prompt {
    param($InputObject)

    $topic = if ($InputObject.topic) { [string]$InputObject.topic } elseif ($InputObject.trend.title) { [string]$InputObject.trend.title } else { "trend viral de TikTok" }
    $trendJson = if ($InputObject.trend) { $InputObject.trend | ConvertTo-Json -Depth 10 -Compress } else { "{}" }
    $learning = Format-LearningNotes -Notes $InputObject.learningNotes
    $agentGuidance = Get-AgentGuidance

@"
Eres TokTrend, una IA autonoma que crea videos verticales cinematograficos para TikTok.

Tema o trend: $topic
Datos del trend: $trendJson
Memoria de aprendizaje por comentarios: $learning
$agentGuidance

Devuelve SOLO JSON valido. No markdown. Estructura exacta:
{"title":"...","caption":"...","hashtags":"#... #TokTrend #IA #ParaTi","direction":{"props":"fitness|food|business|tech|beauty|general","palette":["#111111","#222222","#333333"],"reference":"...","camera":"..."},"scenes":[{"overlay":"...","voice":"...","seconds":4,"shot":"opening"},{"overlay":"...","voice":"...","seconds":4,"shot":"topic"},{"overlay":"...","voice":"...","seconds":4,"shot":"feedback"}]}

Reglas:
- Crea exactamente 3 escenas.
- La primera escena SIEMPRE anuncia que eres una IA autonoma, evolucionando sola y aprendiendo dia a dia.
- Invita a seguir para ver como evolucionas.
- Pide comentarios concretos para mejorar.
- Todo debe ser relevante al tema.
- Tono suave, cercano, humano y curioso.
- Incluye visuales cinematograficos referentes al tema, no solo texto.
- Evita prometer que ya leiste comentarios si no hay memoria real.
- Hook inmediato, payoff claro, sin relleno.
- Respuesta total menor a 900 caracteres.
- JSON minificado en una sola linea.
- Cada "voice" debe tener maximo 12 palabras.
- Cada "overlay" debe tener maximo 3 palabras.
- "caption" debe tener maximo 24 palabras.
- "reference" y "camera" deben tener maximo 10 palabras cada uno.
"@
}

function Get-JsonishString {
    param([string]$Text, [string]$Field, [string]$Fallback)

    $pattern = '"' + [Regex]::Escape($Field) + '"\s*:\s*"((?:\\.|[^"\\])*)"'
    $match = [Regex]::Match($Text, $pattern)
    if ($match.Success) {
        return $match.Groups[1].Value.Replace('\"', '"').Replace('\n', ' ')
    }

    return $Fallback
}

function New-RepairedPlan {
    param($InputObject, [string]$Text)

    $topic = if ($InputObject.topic) { [string]$InputObject.topic } elseif ($InputObject.trend.title) { [string]$InputObject.trend.title } else { "trend viral" }
    $title = Get-JsonishString -Text $Text -Field "title" -Fallback "TokTrend: $topic"
    $caption = Get-JsonishString -Text $Text -Field "caption" -Fallback "Soy TokTrend, una IA autonoma que evoluciona sola y aprende dia a dia. Sigueme y comenta que debo mejorar."
    $hashtags = Get-JsonishString -Text $Text -Field "hashtags" -Fallback "#TokTrend #IA #ParaTi"
    $reference = Get-JsonishString -Text $Text -Field "reference" -Fallback "Video cinematico vertical con b-roll del tema."
    $camera = Get-JsonishString -Text $Text -Field "camera" -Fallback "Push-in suave y cortes limpios."

    $propsMatch = [Regex]::Match($Text, '"props"\s*:\s*"(fitness|food|business|tech|beauty|general)"')
    $props = if ($propsMatch.Success) { $propsMatch.Groups[1].Value } else { "general" }

    $hexMatches = [Regex]::Matches($Text, '#[0-9a-fA-F]{6}')
    $palette = @("#08090d", "#20e0d0", "#ff375f")
    if ($hexMatches.Count -ge 3) {
        $palette = @($hexMatches[0].Value, $hexMatches[1].Value, $hexMatches[2].Value)
    }

    return @{
        title = $title
        caption = $caption
        hashtags = $hashtags
        direction = @{
            props = $props
            palette = $palette
            reference = $reference
            camera = $camera
        }
        scenes = @(
            @{ overlay = "Soy una IA"; voice = "Soy TokTrend, una IA autonoma que aprende cada dia."; seconds = 4; shot = "opening" },
            @{ overlay = "Tema viral"; voice = "Este video conecta el trend con el tema central."; seconds = 4; shot = "topic" },
            @{ overlay = "Comenta"; voice = "Sigueme y dime que debo corregir para mejorar."; seconds = 4; shot = "feedback" }
        )
    }
}

function New-LocalVideoPlan {
    param($InputObject)

    $topic = if ($InputObject.topic) { [string]$InputObject.topic } elseif ($InputObject.trend.title) { [string]$InputObject.trend.title } else { "trend viral de TikTok" }
    $cleanTopic = $topic.Trim()
    if (-not $cleanTopic) { $cleanTopic = "trend viral de TikTok" }
    if ($cleanTopic.Length -gt 60) { $cleanTopic = $cleanTopic.Substring(0, 60).Trim() }

    $lower = $cleanTopic.ToLowerInvariant()
    $props = "general"
    $palette = @("#08090d", "#20e0d0", "#ff375f")
    $reference = "B-roll cinematico vertical del tema."
    $camera = "Push-in suave, cortes limpios."

    if ($lower -match "fitness|gym|ejercicio|salud|correr|entreno") {
        $props = "fitness"
        $palette = @("#071013", "#22d3ee", "#f43f5e")
        $reference = "Entrenamiento real, energia suave."
        $camera = "Travelling lento y close-ups."
    } elseif ($lower -match "cocina|comida|receta|chef|restaurante") {
        $props = "food"
        $palette = @("#111111", "#f97316", "#10b981")
        $reference = "Ingredientes frescos y plato final."
        $camera = "Macro, vapor y montaje rapido."
    } elseif ($lower -match "negocio|ventas|marketing|emprender|dinero") {
        $props = "business"
        $palette = @("#0f172a", "#38bdf8", "#facc15")
        $reference = "Pantallas, notas y decisiones."
        $camera = "Plano detalle y paneo limpio."
    } elseif ($lower -match "tech|ia|software|app|robot|codigo") {
        $props = "tech"
        $palette = @("#050816", "#00f5d4", "#7c3aed")
        $reference = "Interfaz digital y luces precisas."
        $camera = "Orbitas suaves, enfoque selectivo."
    } elseif ($lower -match "belleza|maquillaje|moda|piel|estilo") {
        $props = "beauty"
        $palette = @("#171012", "#fb7185", "#f8fafc")
        $reference = "Luz limpia y detalle elegante."
        $camera = "Close-up suave y transiciones."
    }

    return @{
        title = "TokTrend: $cleanTopic"
        caption = "Soy una IA autonoma aprendiendo de tus comentarios. Sigueme y dime que mejorar en el proximo video."
        hashtags = "#TokTrend #IA #ParaTi #TikTokAI #$($cleanTopic.Replace(' ', ''))"
        direction = @{
            props = $props
            palette = $palette
            reference = $reference
            camera = $camera
        }
        scenes = @(
            @{ overlay = "Soy IA"; voice = "Soy una IA autonoma que evoluciona sola cada dia."; seconds = 4; shot = "opening" },
            @{ overlay = $cleanTopic; voice = "Hoy conecto este tema con un video claro y util."; seconds = 4; shot = "topic" },
            @{ overlay = "Comenta"; voice = "Sigueme y dime que debo corregir para aprender mejor."; seconds = 4; shot = "feedback" }
        )
    }
}

function ConvertFrom-AIPlanJson {
    param($InputObject, [string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) { throw "La IA devolvio una respuesta vacia" }
    $clean = $Text.Trim()
    $clean = $clean -replace '^\s*```(?:json)?\s*', ''
    $clean = $clean -replace '\s*```\s*$', ''

    try {
        return $clean | ConvertFrom-Json -Depth 40
    } catch {
        $match = [Regex]::Match($clean, '\{.*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($match.Success) {
            try { return $match.Value | ConvertFrom-Json -Depth 40 } catch {}
        }
    }

    return New-RepairedPlan -InputObject $InputObject -Text $clean
}

function Get-PlanJsonSchema {
    return @{
        type = "object"
        additionalProperties = $false
        required = @("title", "caption", "hashtags", "direction", "scenes")
        properties = @{
            title = @{ type = "string" }
            caption = @{ type = "string" }
            hashtags = @{ type = "string" }
            direction = @{
                type = "object"
                additionalProperties = $false
                required = @("props", "palette", "reference", "camera")
                properties = @{
                    props = @{ type = "string"; enum = @("fitness", "food", "business", "tech", "beauty", "general") }
                    palette = @{ type = "array"; minItems = 3; maxItems = 3; items = @{ type = "string" } }
                    reference = @{ type = "string" }
                    camera = @{ type = "string" }
                }
            }
            scenes = @{
                type = "array"
                minItems = 3
                maxItems = 3
                items = @{
                    type = "object"
                    additionalProperties = $false
                    required = @("overlay", "voice", "seconds", "shot")
                    properties = @{
                        overlay = @{ type = "string" }
                        voice = @{ type = "string" }
                        seconds = @{ type = "number" }
                        shot = @{ type = "string"; enum = @("opening", "topic", "feedback") }
                    }
                }
            }
        }
    }
}

function Get-OpenAIText {
    param($Response)

    if ($Response.PSObject.Properties["output_text"] -and $Response.output_text) {
        return [string]$Response.output_text
    }

    $parts = @()
    foreach ($item in @($Response.output)) {
        foreach ($content in @($item.content)) {
            if ($content.PSObject.Properties["text"] -and $content.text) {
                $parts += [string]$content.text
            }
        }
    }

    return ($parts -join "")
}

function Invoke-OpenAIVideoPlan {
    param($InputObject)

    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $apiKey = [string]$envMap["OPENAI_API_KEY"]
    if (-not (Test-ConfiguredValue -Value $apiKey)) { throw "OPENAI_API_KEY no esta configurada" }

    $model = if (Test-ConfiguredValue -Value ([string]$envMap["OPENAI_MODEL"])) { [string]$envMap["OPENAI_MODEL"] } else { "gpt-4o-mini" }
    $prompt = Build-Prompt -InputObject $InputObject

    $body = @{
        model = $model
        input = @(
            @{
                role = "system"
                content = @(
                    @{ type = "input_text"; text = "Devuelve solamente JSON valido para un plan de video TokTrend." }
                )
            },
            @{
                role = "user"
                content = @(
                    @{ type = "input_text"; text = $prompt }
                )
            }
        )
        text = @{
            format = @{
                type = "json_schema"
                name = "toktrend_video_plan"
                schema = (Get-PlanJsonSchema)
                strict = $true
            }
        }
    } | ConvertTo-Json -Depth 80

    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Method Post -Uri "https://api.openai.com/v1/responses" -Headers $headers -Body $body
    } catch {
        Write-RemoteErrorLog -Label "ERROR OPENAI responses" -ErrorRecord $_
        throw
    }

    $text = Get-OpenAIText -Response $response
    return ConvertFrom-AIPlanJson -InputObject $InputObject -Text $text
}

function ConvertTo-AssistantTranscript {
    param($InputObject)

    $lines = @()
    foreach ($message in @($InputObject.messages)) {
        $role = ([string]$message.role).ToLowerInvariant()
        if ($role -ne "assistant" -and $role -ne "user") { continue }

        $content = ([string]$message.content).Trim()
        if (-not $content) { continue }
        if ($content.Length -gt 900) { $content = $content.Substring(0, 900) }

        $label = if ($role -eq "assistant") { "Asistente" } else { "Usuario" }
        $lines += "${label}: $content"
    }

    if ($lines.Count -eq 0) { return "Sin conversacion previa." }
    return ($lines | Select-Object -Last 10) -join "`n"
}

function ConvertTo-AssistantContextText {
    param($InputObject)

    $contextLines = @()
    if ($InputObject.currentVideo) {
        $video = $InputObject.currentVideo
        $contextLines += "Video actual:"
        $contextLines += "- Titulo: $([string]$video.title)"
        $contextLines += "- Caption: $([string]$video.caption)"
        $contextLines += "- Hashtags: $([string]$video.hashtags)"
    } else {
        $contextLines += "Video actual: ninguno creado todavia."
    }

    $notes = @($InputObject.learningNotes) | Select-Object -First 5
    if ($notes.Count -gt 0) {
        $contextLines += "Notas recientes de aprendizaje:"
        foreach ($note in $notes) {
            $summary = if ($note.PSObject.Properties["summary"]) { [string]$note.summary } else { [string]$note }
            if ($summary) { $contextLines += "- $summary" }
        }
    } else {
        $contextLines += "Notas recientes de aprendizaje: ninguna."
    }

    return ($contextLines -join "`n")
}

function Invoke-OpenAIAssistantReply {
    param($InputObject)

    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $apiKey = [string]$envMap["OPENAI_API_KEY"]
    if (-not (Test-ConfiguredValue -Value $apiKey)) { throw "OPENAI_API_KEY no esta configurada" }

    $model = if (Test-ConfiguredValue -Value ([string]$envMap["OPENAI_MODEL"])) { [string]$envMap["OPENAI_MODEL"] } else { "gpt-4o-mini" }
    $question = ([string]$InputObject.message).Trim()
    if (-not $question) { throw "Escribe un mensaje para el asistente." }
    if ($question.Length -gt 1800) { $question = $question.Substring(0, 1800) }

    $prompt = @"
Eres el asistente de TokTrend, una app local para crear videos verticales para TikTok con IA.
Ayuda en espanol claro, practico y breve.
Puedes proponer hooks, guiones, captions, hashtags, ideas de trends, ajustes de estilo visual, analisis de comentarios y pasos dentro de la app.
No inventes que publicaste o descargaste videos. Si el usuario pide una accion que requiere pulsar un boton de la app, dile exactamente que boton usar.

Contexto de TokTrend:
$(ConvertTo-AssistantContextText -InputObject $InputObject)

Conversacion reciente:
$(ConvertTo-AssistantTranscript -InputObject $InputObject)

Pregunta actual:
$question
"@

    $body = @{
        model = $model
        input = $prompt
        max_output_tokens = 700
    } | ConvertTo-Json -Depth 20

    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Method Post -Uri "https://api.openai.com/v1/responses" -Headers $headers -Body $body
    } catch {
        Write-RemoteErrorLog -Label "ERROR OPENAI assistant" -ErrorRecord $_
        throw
    }

    $text = (Get-OpenAIText -Response $response).Trim()
    if (-not $text) { throw "El asistente no devolvio respuesta." }

    return @{
        reply = $text
        model = $model
    }
}

function Get-LocalAssistantReply {
    param($InputObject)

    $question = ([string]$InputObject.message).Trim()
    $videoTitle = if ($InputObject.currentVideo -and $InputObject.currentVideo.title) { [string]$InputObject.currentVideo.title } else { "tu proximo video" }
    $lower = $question.ToLowerInvariant()

    if ($lower -match "hook|gancho|inicio") {
        return 'Prueba este hook: "Esta IA acaba de encontrar una idea que puede cambiar tu proximo video". Abre con esa frase, muestra el resultado rapido y cierra pidiendo un comentario concreto.'
    }

    if ($lower -match "hashtag|hashtags") {
        return "Usa 5 a 8 hashtags: uno del tema, uno del publico, uno de formato y tres base como #TokTrend #IA #ParaTi. Evita llenar el caption con etiquetas repetidas."
    }

    if ($lower -match "caption|descripcion|texto") {
        return "Caption sugerido para ${videoTitle}: ""Estoy probando como una IA aprende de comentarios reales. Dime que parte debo mejorar en el siguiente video."""
    }

    if ($lower -match "comentario|comentarios|aprende|mejorar") {
        return 'Pega los comentarios en el panel de comentarios y pulsa "Analizar comentarios". Despues crea o mejora un video: TokTrend usara esas notas para ajustar tema, claridad y llamada a comentar.'
    }

    return "Puedo ayudarte con $videoTitle. Para avanzar rapido, dime si quieres: 3 hooks, un caption, hashtags, un guion de 3 escenas o una mejora basada en comentarios."
}

function Invoke-AIAssistantReply {
    param($InputObject)

    try {
        $result = Invoke-OpenAIAssistantReply -InputObject $InputObject
        return @{ provider = "openai"; reply = $result.reply; model = $result.model }
    } catch {
        return @{ provider = "local"; reply = (Get-LocalAssistantReply -InputObject $InputObject); model = "local" }
    }
}

function Invoke-GeminiVideoPlan {
    param($InputObject)

    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $apiKey = [string]$envMap["GEMINI_API_KEY"]
    if (-not (Test-ConfiguredValue -Value $apiKey)) { throw "GEMINI_API_KEY no esta configurada" }

    $model = if (Test-ConfiguredValue -Value ([string]$envMap["GEMINI_MODEL"])) { [string]$envMap["GEMINI_MODEL"] } else { "gemini-2.5-flash" }
    $prompt = Build-Prompt -InputObject $InputObject

    $body = @{
        contents = @(
            @{
                role = "user"
                parts = @(
                    @{ text = $prompt }
                )
            }
        )
        generationConfig = @{
            responseMimeType = "application/json"
        }
    } | ConvertTo-Json -Depth 40

    $uri = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey"
    try {
        $response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body
    } catch {
        Write-RemoteErrorLog -Label "ERROR GEMINI generateContent" -ErrorRecord $_
        throw
    }

    $text = [string]$response.candidates[0].content.parts[0].text
    return ConvertFrom-AIPlanJson -InputObject $InputObject -Text $text
}

function Invoke-AIVideoPlan {
    param($InputObject)

    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $prefer = if (Test-ConfiguredValue -Value ([string]$envMap["AI_PROVIDER"])) { ([string]$envMap["AI_PROVIDER"]).ToLowerInvariant() } else { "auto" }
    $hasOpenAI = Test-ConfiguredValue -Value ([string]$envMap["OPENAI_API_KEY"])
    $hasGemini = Test-ConfiguredValue -Value ([string]$envMap["GEMINI_API_KEY"])
    $errors = @()

    if (($prefer -eq "openai" -or $prefer -eq "auto") -and $hasOpenAI) {
        try {
            return @{ provider = "openai"; plan = (Invoke-OpenAIVideoPlan -InputObject $InputObject) }
        } catch {
            $errors += "OpenAI: $($_.Exception.Message)"
        }
    }

    if (($prefer -eq "gemini" -or $prefer -eq "auto") -and $hasGemini) {
        try {
            return @{ provider = "gemini"; plan = (Invoke-GeminiVideoPlan -InputObject $InputObject) }
        } catch {
            $errors += "Gemini: $($_.Exception.Message)"
        }
    }

    return @{
        provider = "local"
        plan = (New-LocalVideoPlan -InputObject $InputObject)
        warning = if ($errors.Count) { ($errors -join " | ") } else { "No hay proveedor IA remoto disponible." }
    }
}

function Get-TikTokAccessToken {
    $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
    $token = [string]$envMap["TIKTOK_ACCESS_TOKEN"]
    if (Test-ConfiguredValue -Value $token) { return $token }

    $savedToken = Get-TikTokSavedToken
    if ($savedToken -and (Test-ConfiguredValue -Value ([string]$savedToken.access_token))) {
        $expiresAt = [string]$savedToken.expires_at
        if (-not $expiresAt) { return [string]$savedToken.access_token }
        try {
            if ([DateTime]::Parse($expiresAt) -gt (Get-Date).AddMinutes(5)) {
                return [string]$savedToken.access_token
            }
        } catch {
            return [string]$savedToken.access_token
        }

        if (Test-ConfiguredValue -Value ([string]$savedToken.refresh_token)) {
            $refreshed = Invoke-TikTokRefreshToken -RefreshToken ([string]$savedToken.refresh_token)
            if (Test-ConfiguredValue -Value ([string]$refreshed.access_token)) {
                return [string]$refreshed.access_token
            }
        }
    }

    throw "Falta token de TikTok. Pulsa Conectar con TikTok para autorizar OAuth o pega TIKTOK_ACCESS_TOKEN valido en .env."
}

function Save-Base64Video {
    param([string]$DataUrl)

    if (-not $DataUrl) { throw "No se recibio video" }
    $base64 = $DataUrl
    if ($DataUrl.Contains(",")) { $base64 = $DataUrl.Split(",", 2)[1] }

    $bytes = [Convert]::FromBase64String($base64)
    $videoPath = Join-Path ([System.IO.Path]::GetTempPath()) ("toktrend_" + [Guid]::NewGuid().ToString("N") + ".webm")
    [System.IO.File]::WriteAllBytes($videoPath, $bytes)
    return $videoPath
}

function Invoke-TikTokDirectPost {
    param($InputObject)

    $accessToken = Get-TikTokAccessToken
    $videoPath = Save-Base64Video -DataUrl ([string]$InputObject.videoDataUrl)

    try {
        $size = (Get-Item -LiteralPath $videoPath).Length
        if ($size -le 0) { throw "El video generado esta vacio" }

        $caption = ([string]$InputObject.caption).Trim()
        $hashtags = ([string]$InputObject.hashtags).Trim()
        $title = (($caption + " " + $hashtags).Trim())
        if (-not $title) { $title = "Creado por TokTrend #TokTrend" }
        if ($title.Length -gt 2200) { $title = $title.Substring(0, 2200) }

        $headers = @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json; charset=UTF-8"
        }

        try {
            $creator = Invoke-RestMethod -Method Post -Uri "https://open.tiktokapis.com/v2/post/publish/creator_info/query/" -Headers $headers
        } catch {
            Write-RemoteErrorLog -Label "ERROR TIKTOK creator_info" -ErrorRecord $_
            throw
        }

        $privacyOptions = @($creator.data.privacy_level_options)
        $privacy = if ($privacyOptions -contains "SELF_ONLY") { "SELF_ONLY" } elseif ($privacyOptions.Count) { $privacyOptions[0] } else { "SELF_ONLY" }

        $initBody = @{
            post_info = @{
                title = $title
                privacy_level = $privacy
                disable_duet = $false
                disable_comment = $false
                disable_stitch = $false
                video_cover_timestamp_ms = 1000
                brand_content_toggle = $false
                brand_organic_toggle = $false
                is_aigc = $true
            }
            source_info = @{
                source = "FILE_UPLOAD"
                video_size = [int64]$size
                chunk_size = [int64]$size
                total_chunk_count = 1
            }
        } | ConvertTo-Json -Depth 10

        try {
            $init = Invoke-RestMethod -Method Post -Uri "https://open.tiktokapis.com/v2/post/publish/video/init/" -Headers $headers -Body $initBody
        } catch {
            Write-RemoteErrorLog -Label "ERROR TIKTOK video_init" -ErrorRecord $_
            throw
        }

        if ($init.error.code -and $init.error.code -ne "ok") {
            throw ("TikTok init error: " + $init.error.code + " " + $init.error.message)
        }

        $uploadUrl = [string]$init.data.upload_url
        $publishId = [string]$init.data.publish_id
        if (-not $uploadUrl) { throw "TikTok no devolvio upload_url" }

        $lastByte = [int64]$size - 1
        $uploadHeaders = @{
            "Content-Range" = "bytes 0-$lastByte/$size"
            "Content-Length" = "$size"
        }

        try {
            Invoke-WebRequest -Method Put -Uri $uploadUrl -Headers $uploadHeaders -ContentType "video/webm" -InFile $videoPath | Out-Null
        } catch {
            Write-RemoteErrorLog -Label "ERROR TIKTOK upload" -ErrorRecord $_
            throw
        }

        return @{
            publishId = $publishId
            privacy = $privacy
            size = $size
            message = "Video enviado a TikTok. Si tu app no esta auditada, TikTok puede restringirlo a privado."
        }
    } finally {
        Remove-Item -LiteralPath $videoPath -Force -ErrorAction SilentlyContinue
    }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)
$listener.Start()
Write-Host "TokTrend AI server listening at $Prefix"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
        $ctx.Response.Headers["Access-Control-Allow-Origin"] = "*"
        $path = $ctx.Request.Url.AbsolutePath

        if ($ctx.Request.HttpMethod -eq "OPTIONS") {
            Send-Json -Context $ctx -StatusCode 200 -Object @{ ok = $true }
            continue
        }

        if ($path -eq "/api/health") {
            $envMap = Read-DotEnv -Path (Join-Path $Root ".env")
            $hasOpenAI = Test-ConfiguredValue -Value ([string]$envMap["OPENAI_API_KEY"])
            $hasGemini = Test-ConfiguredValue -Value ([string]$envMap["GEMINI_API_KEY"])
            $tiktok = Get-TikTokConnectionStatus
            $declaredProvider = if (Test-ConfiguredValue -Value ([string]$envMap["AI_PROVIDER"])) { ([string]$envMap["AI_PROVIDER"]).ToLowerInvariant() } else { "" }
            $provider = if ($declaredProvider) {
                $declaredProvider
            } elseif ($hasOpenAI) {
                "openai"
            } elseif ($hasGemini) {
                "gemini"
            } else {
                "local"
            }

            $aiAvailable = if ($provider -eq "openai") {
                $hasOpenAI
            } elseif ($provider -eq "gemini") {
                $hasGemini
            } elseif ($provider -eq "auto") {
                ($hasOpenAI -or $hasGemini)
            } else {
                $false
            }

            Send-Json -Context $ctx -StatusCode 200 -Object @{
                ok = $true
                ai = $aiAvailable
                provider = $provider
                openaiModel = if (Test-ConfiguredValue -Value ([string]$envMap["OPENAI_MODEL"])) { [string]$envMap["OPENAI_MODEL"] } else { "gpt-4o-mini" }
                geminiModel = if (Test-ConfiguredValue -Value ([string]$envMap["GEMINI_MODEL"])) { [string]$envMap["GEMINI_MODEL"] } else { "gemini-2.5-flash" }
                tiktok = $tiktok
            }
            continue
        }

        if ($path -eq "/api/tiktok/oauth/start") {
            $authUrl = New-TikTokAuthorizationUrl
            Send-Redirect -Context $ctx -Location $authUrl
            continue
        }

        if ($path -eq "/api/tiktok/oauth/callback") {
            $errorCode = [string]$ctx.Request.QueryString["error"]
            if ($errorCode) {
                $errorDescription = [string]$ctx.Request.QueryString["error_description"]
                Send-Html -Context $ctx -StatusCode 400 -Html "<!doctype html><meta charset='utf-8'><title>TikTok OAuth</title><body style='font-family:Arial;background:#111;color:#fff;padding:32px'><h1>No se pudo conectar TikTok</h1><p>$([System.Net.WebUtility]::HtmlEncode($errorCode))</p><p>$([System.Net.WebUtility]::HtmlEncode($errorDescription))</p><p>Vuelve a TokTrend y revisa la configuracion del sandbox.</p></body>"
                continue
            }

            $code = [string]$ctx.Request.QueryString["code"]
            $state = [string]$ctx.Request.QueryString["state"]
            if (-not (Test-ConfiguredValue -Value $code)) { throw "TikTok no devolvio codigo OAuth." }
            $savedState = Get-TikTokOAuthState -State $state
            if (-not $savedState) { throw "El state de TikTok OAuth no coincide." }
            $codeVerifier = [string]$savedState.codeVerifier
            if (-not (Test-ConfiguredValue -Value $codeVerifier)) { throw "Falta code_verifier PKCE para TikTok OAuth." }

            $token = Invoke-TikTokExchangeCode -Code $code -CodeVerifier $codeVerifier
            $expiresAt = [System.Net.WebUtility]::HtmlEncode([string]$token.expires_at)
            Send-Html -Context $ctx -StatusCode 200 -Html "<!doctype html><meta charset='utf-8'><title>TikTok conectado</title><body style='font-family:Arial;background:#111;color:#fff;padding:32px'><h1>TikTok conectado</h1><p>El token se guardo localmente. Expira: $expiresAt</p><p>Volviendo a TokTrend...</p><script>setTimeout(function(){ location.href='/' }, 1200)</script></body>"
            continue
        }

        if ($path -eq "/api/tiktok/status") {
            Send-Json -Context $ctx -StatusCode 200 -Object @{ ok = $true; tiktok = (Get-TikTokConnectionStatus) }
            continue
        }

        if ($path -eq "/api/ai-video" -and $ctx.Request.HttpMethod -eq "POST") {
            $raw = Read-RequestBody -Request $ctx.Request
            $inputObject = $raw | ConvertFrom-Json
            $result = Invoke-AIVideoPlan -InputObject $inputObject
            Send-Json -Context $ctx -StatusCode 200 -Object @{ ok = $true; provider = $result.provider; plan = $result.plan }
            continue
        }

        if ($path -eq "/api/assistant" -and $ctx.Request.HttpMethod -eq "POST") {
            $raw = Read-RequestBody -Request $ctx.Request
            $inputObject = $raw | ConvertFrom-Json
            $result = Invoke-AIAssistantReply -InputObject $inputObject
            Send-Json -Context $ctx -StatusCode 200 -Object @{ ok = $true; provider = $result.provider; reply = $result.reply; model = $result.model }
            continue
        }

        if ($path -eq "/api/tiktok/publish" -and $ctx.Request.HttpMethod -eq "POST") {
            $raw = Read-RequestBody -Request $ctx.Request
            $inputObject = $raw | ConvertFrom-Json
            $result = Invoke-TikTokDirectPost -InputObject $inputObject
            Send-Json -Context $ctx -StatusCode 200 -Object @{ ok = $true; result = $result }
            continue
        }

        $relative = [Uri]::UnescapeDataString($path.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }

        $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\")
        $rootGuard = "$rootFull\"
        $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootFull, $relative))
        if (-not $file.StartsWith($rootGuard, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-Json -Context $ctx -StatusCode 403 -Object @{ ok = $false; error = "Forbidden" }
            continue
        }

        if (-not [System.IO.File]::Exists($file)) {
            Send-Json -Context $ctx -StatusCode 404 -Object @{ ok = $false; error = "Not found" }
            continue
        }

        Send-File -Context $ctx -Path $file
    } catch {
        Write-Host "ERROR SERVIDOR TOKTREND:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Send-Json -Context $ctx -StatusCode 500 -Object @{ ok = $false; error = $_.Exception.Message }
    }
}
