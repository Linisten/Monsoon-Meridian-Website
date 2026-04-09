Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\Sk\mm\Monsoon-Meridian-Website\public\logo.jpg")
$pw = 384; $ph = [int]($img.Height * $pw / $img.Width)
$bmp = New-Object System.Drawing.Bitmap $pw,$ph
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.DrawImage($img, 0, 0, $pw, $ph)
$gfx.Dispose(); $img.Dispose()

$firstBlackRow = $ph
for ($y=0; $y -lt $ph; $y++) {
    for ($x=0; $x -lt $pw; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.GetBrightness() -lt 0.71) {
            $firstBlackRow = $y
            break
        }
    }
    if ($firstBlackRow -ne $ph) { break }
}
$bmp.Dispose()
Write-Host "First row with black pixels: $firstBlackRow"
Write-Host "Total height: $ph"
