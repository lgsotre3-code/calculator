#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir

$titleMap = [ordered]@{
    'blog\property-taxes-home-insurance\index.html' = 'Property Taxes & Home Insurance: Hidden Costs'
    'blog\first-time-buyer-programs\index.html' = 'First-Time Buyer Programs: Federal & State Help'
    'blog\mortgage-points-vs-bigger-down-payment\index.html' = 'Discount Points vs Down Payment: Where to Put $4K'
    'blog\pmi-guide\index.html' = 'PMI Explained: What It Costs & How to Remove It'
    'blog\refinance-break-even\index.html' = 'When Does Refinancing Pay Off? Break-Even Guide'
    'blog\extra-mortgage-payments\index.html' = 'Extra Mortgage Payments: How $200 Saves $103K'
    'blog\renting-vs-buying-real-numbers\index.html' = 'Renting vs Buying: The Real Numbers for 2026'
    'blog\portabilidade-financiamento-imobiliario\index.html' = 'Portabilidade Imobiliária: Vale a Pena?'
    'blog\best-mortgage-lenders.html' = 'Best Mortgage Lenders for First-Time Buyers 2026'

    'pt\blog\property-taxes-home-insurance\index.html' = 'IPTU e Seguro Residencial: Custos Ocultos'
    'pt\blog\first-time-buyer-programs\index.html' = 'Programas Primeiro Imóvel: Auxílio Federal'
    'pt\blog\home-buying-process-timeline\index.html' = 'Processo de Compra: Da Aprovação ao Fechamento'
    'pt\blog\refinance-break-even\index.html' = 'Refinanciamento: Quando Compensa?'
    'pt\blog\best-mortgage-lenders.html' = 'Melhores Credores para Primeiros Compradores'
    'pt\blog\credit-score-mortgage\index.html' = 'Score de Crédito e Financiamento'
    'pt\blog\va-loan-vs-conventional\index.html' = 'Empréstimo VA vs. Convencional: Qual Melhor?'
    'pt\blog\closing-costs-explained\index.html' = 'Custos de Fechamento ao Comprar Imóvel'
    'pt\blog\choosing-mortgage-term\index.html' = 'Prazo do Financiamento: 15 vs 20 vs 30 Anos'
    'pt\blog\mortgage-pre-approval\index.html' = 'Pré-Aprovação: O Que Você Precisa Saber'
    'pt\blog\comparing-mortgage-offers\index.html' = 'Como Comparar Propostas de Financiamento'
    'pt\blog\renting-vs-buying-real-numbers\index.html' = 'Alugar ou Comprar: Os Números Reais 2026'
    'pt\blog\fha-vs-conventional-loans.html' = 'Empréstimo FHA vs. Convencional: Qual Ideal?'
    'pt\blog\arm-vs-fixed-rate\index.html' = 'ARM vs. Taxa Fixa: Qual é Melhor?'
    'pt\blog\extra-mortgage-payments\index.html' = 'Pagamentos Extras: Como $200/Mês Economiza'
    'pt\blog\mortgage-points-explained\index.html' = 'Pontos de Hipoteca: Vale a Pena Reduzir?'

    'es\blog\first-time-buyer-programs\index.html' = 'Programas Primera Vivienda: Asistencia'
    'es\blog\property-taxes-home-insurance\index.html' = 'Impuestos y Seguro de Vivienda: Costos Ocultos'
    'es\blog\home-buying-process-timeline\index.html' = 'Proceso de Compra: De Preaprobación al Cierre'
    'es\blog\refinance-break-even\index.html' = 'Refinanciar: ¿Cuándo Compensa? El Punto Equilibrio'
    'es\blog\best-mortgage-lenders.html' = 'Mejores Prestamistas para Primerizos 2026'
    'es\blog\fha-vs-conventional-loans.html' = 'Préstamos FHA vs. Convencionales: ¿Cuál Mejor?'
    'es\blog\extra-mortgage-payments\index.html' = 'Pagos Extra: Cómo $200/Mes Ahorran $103K'
    'es\blog\mortgage-points-vs-bigger-down-payment\index.html' = 'Puntos vs Enganche: ¿Dónde Invertir $4K?'
    'es\blog\choosing-mortgage-term\index.html' = 'Plazo Hipotecario: 15 vs 20 vs 30 Años'
    'es\blog\credit-score-mortgage\index.html' = 'Puntaje de Crédito e Hipotecas 2026'
    'es\blog\va-loan-vs-conventional\index.html' = 'Préstamo VA vs. Hipoteca: ¿Cuál es Mejor?'
    'es\blog\comparing-mortgage-offers\index.html' = 'Comparar Ofertas Hipotecarias de Prestamistas'
    'es\blog\closing-costs-explained\index.html' = 'Gastos de Cierre al Comprar una Casa'

    'fr\blog\closing-costs-explained\index.html' = 'Frais de Clôture : Ce Qu''il Faut Savoir'
    'fr\blog\home-buying-process-timeline\index.html' = 'Achat Immobilier: De la Préapprobation à la Clôture'
    'fr\blog\mortgage-payments-guide\index.html' = 'Calculer Mensualités d''un Prêt Immobilier'
    'fr\blog\extra-mortgage-payments\index.html' = 'Remboursements Anticipés: Comment 200$/Mois Aident'
    'fr\blog\property-taxes-home-insurance\index.html' = 'Taxes Foncières et Assurance: Coûts Cachés'
    'fr\blog\credit-score-mortgage\index.html' = 'Score de Crédit et Prêts Hypothécaires 2026'
    'fr\blog\pmi-guide\index.html' = 'PMI: Définition et Comment l''Éviter'
    'fr\blog\refinance-break-even\index.html' = 'Rachat de Crédit: Quand Paie-t-il?'
    'fr\blog\first-time-buyer-programs\index.html' = 'Programmes Premiers Acheteurs: Aides 2026'
    'fr\blog\renting-vs-buying-real-numbers\index.html' = 'Louer ou Acheter: Les Vrais Chiffres 2026'
    'fr\blog\how-much-house-can-i-afford\index.html' = 'Quelle Maison Me Puis-Je Permettre?'
    'fr\blog\va-loan-vs-conventional\index.html' = 'Prêt VA vs. Conventionnel: Lequel est Mieux?'
    'fr\blog\mortgage-pre-approval\index.html' = 'Préapprobation Hypothécaire: Guide 2026'
    'fr\blog\mortgage-points-explained\index.html' = 'Points Hypothécaires: Faut-il Racheter?'
    'fr\blog\pmi-guide-remove-early\index.html' = 'PMI: Coût et Comment l''Éliminer Plus Tôt'
    'fr\blog\mortgage-points-vs-bigger-down-payment\index.html' = 'Points vs Apport: Où Investir 4 000$?'
    'fr\blog\best-mortgage-lenders.html' = 'Meilleurs Prêteurs pour Primo-Accédants 2026'
    'fr\blog\mortgage-affordability-28-36-rule\index.html' = 'Combien Emprunter? La Règle des 28/36'

    'de\blog\property-taxes-home-insurance\index.html' = 'Grundsteuer & Wohngebäudeversicherung'
    'de\blog\first-time-buyer-programs\index.html' = 'Programme für Erstkäufer: Bund & Länder'
    'de\blog\pmi-guide\index.html' = 'Private Hypothekenversicherung (PMI) Erklärt'
    'de\blog\mortgage-payments-guide\index.html' = 'Hypothekenzahlung Berechnen: Schritt für Schritt'
    'de\blog\choosing-mortgage-term\index.html' = 'Hypothekenlaufzeit: 15 vs. 20 vs. 30 Jahre'
    'de\blog\home-buying-process-timeline\index.html' = 'Hauskauf-Zeitplan: Bis zum Abschluss'
    'de\blog\va-loan-vs-conventional\index.html' = 'VA-Darlehen vs. Hypothek: Was Passt Besser?'
    'de\blog\mortgage-affordability-28-36-rule\index.html' = 'Wie Viel Hypothek? Die 28/36-Regel'
    'de\blog\how-much-house-can-i-afford\index.html' = 'Wie Viel Haus Kann Ich Mir Leisten?'
    'de\blog\fha-vs-conventional-loans.html' = 'FHA vs. Konventionelle Kredite: Was Passt?'
    'de\blog\comparing-mortgage-offers\index.html' = 'Hypothekenangebote Vergleichen'
    'de\blog\closing-costs-explained\index.html' = 'Abschlusskosten beim Hauskauf Erklärt'
    'de\blog\mortgage-points-explained\index.html' = 'Hypothekenpunkte: Zinssatz Abkaufen?'
}

$pattern = '(?s)<title\b[^>]*>(?<inner>.*?)</title\s*>'
$bareAmpPattern = '&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)'

$changed = 0
$unchanged = 0
$missing = 0
$errors = 0

Write-Host ("Loaded {0} title mappings. Project root: {1}" -f $titleMap.Count, $projectRoot)

foreach ($rel in $titleMap.Keys) {
    $newTitle = [string]$titleMap[$rel]
    $newVisibleLen = ([System.Net.WebUtility]::HtmlDecode($newTitle)).Length

    Write-Host ("`n[{0}] {1}" -f $rel, $newTitle)

    if ($newVisibleLen -gt 60) {
        Write-Warning ("  ABORTED - new title is {0} chars (> 60)" -f $newVisibleLen)
        $errors++
        continue
    }

    $path = Join-Path $projectRoot ($rel -replace '/', '\')

    if (-not (Test-Path -LiteralPath $path)) {
        Write-Warning ("  FILE NOT FOUND - {0}" -f $path)
        $missing++
        continue
    }

    try {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($content.Length -gt 0 -and [int][char]$content[0] -eq 0xFEFF) {
            $content = $content.Substring(1)
        }

        $m = [regex]::Match($content, $pattern)
        if (-not $m.Success) {
            Write-Warning "  NO <title> TAG FOUND"
            $errors++
            continue
        }

        $oldInner = $m.Groups['inner'].Value

        $newInner = [regex]::Replace($newTitle, $bareAmpPattern, '&amp;')

        if ($oldInner -eq $newInner) {
            Write-Host "  SKIP - already set"
            $unchanged++
            continue
        }

        $start = $m.Groups['inner'].Index
        $len = $m.Groups['inner'].Length
        $updated = $content.Remove($start, $len).Insert($start, $newInner)

        $encoding = New-Object System.Text.UTF8Encoding($hasBom)
        [System.IO.File]::WriteAllText($path, $updated, $encoding)

        $oldVisibleLen = ([System.Net.WebUtility]::HtmlDecode($oldInner)).Length
        Write-Host ("  CHANGED {0} -> {1} chars" -f $oldVisibleLen, $newVisibleLen)
        Write-Host ("    old: {0}" -f $oldInner.Trim())
        $changed++
    }
    catch {
        Write-Warning ("  ERROR - {0}" -f $_.Exception.Message)
        $errors++
    }
}

Write-Host ""
Write-Host "=============================="
Write-Host "         SUMMARY              "
Write-Host "=============================="
Write-Host ("Total mappings : {0}" -f $titleMap.Count)
Write-Host ("Changed        : {0}" -f $changed)
Write-Host ("Already correct: {0}" -f $unchanged)
Write-Host ("Missing files  : {0}" -f $missing)
Write-Host ("Errors         : {0}" -f $errors)

if ($missing -gt 0 -or $errors -gt 0) { exit 1 }
