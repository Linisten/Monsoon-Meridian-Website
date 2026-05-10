Add-Type -AssemblyName System.Drawing
$logoPath = "c:\Users\slini\mm1\Monsoon-Meridian-Website\public\logo.jpg"
$printer = (Get-WmiObject Win32_Printer | Where-Object {$_.Default -eq $true}).Name

if (-not (Test-Path $logoPath)) { Write-Host "Logo not found at $logoPath"; exit }
Write-Host "Printing logo to $printer..."

$img = [System.Drawing.Image]::FromFile($logoPath)
$maxW = 384
$pw = $img.Width; $ph = $img.Height
if ($pw -gt $maxW) { $ph = [int]($ph * ($maxW / $pw)); $pw = $maxW }
if (($pw % 8) -ne 0) { $pw = [int]([Math]::Ceiling($pw / 8) * 8) }

$bmp = New-Object System.Drawing.Bitmap $pw,$ph
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.Clear([System.Drawing.Color]::White)
$gfx.DrawImage($img, 0, 0, $pw, $ph)

$xL = [byte](($pw / 8) % 256); $xH = [byte]([Math]::Floor(($pw / 8) / 256))
$yL = [byte]($ph % 256); $yH = [byte]([Math]::Floor($ph / 256))

[byte[]]$hdr = @(0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH)
[byte[]]$body = New-Object byte[] ($pw/8 * $ph)
$idx = 0
for ($row=0; $row -lt $ph; $row++) {
    for ($col=0; $col -lt $pw; $col+=8) {
        $byte = 0
        for ($bit=0; $bit -lt 8; $bit++) {
            if ($col+$bit -lt $pw) {
                if ($bmp.GetPixel($col+$bit, $row).GetBrightness() -lt 0.8) { $byte = $byte -bor (1 -shl (7-$bit)) }
            }
        }
        $body[$idx++] = [byte]$byte
    }
}
[byte[]]$full = $hdr + $body + @(0x0A, 0x1B, 0x64, 0x05, 0x1D, 0x56, 0x01)

# Raw print
$rawDef = @"
using System;
using System.Runtime.InteropServices;
public class WP2 {
    [DllImport("winspool.drv",EntryPoint="OpenPrinterA")] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr p);
    [DllImport("winspool.drv",EntryPoint="StartDocPrinterA")] public static extern uint StartDocPrinter(IntPtr h, Int32 lvl, [In] DI di);
    [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv")] public static extern bool WritePrinter(IntPtr h, IntPtr p, Int32 n, out Int32 w);
    [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)] public class DI { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
}
"@
Add-Type -TypeDefinition $rawDef -ErrorAction SilentlyContinue
$h = [IntPtr]::Zero; $di = New-Object WP2+DI; $di.pDocName = 'LogoTest'; $di.pDataType = 'RAW'
if ([WP2]::OpenPrinter($printer,[ref]$h,[IntPtr]::Zero)) {
    [WP2]::StartDocPrinter($h,1,$di) | Out-Null
    [WP2]::StartPagePrinter($h) | Out-Null
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($full.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($full,0,$ptr,$full.Length)
    $wr = 0; [WP2]::WritePrinter($h,$ptr,$full.Length,[ref]$wr) | Out-Null
    [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
    [WP2]::EndPagePrinter($h) | Out-Null
    [WP2]::EndDocPrinter($h) | Out-Null
    [WP2]::ClosePrinter($h) | Out-Null
    Write-Host "Sent to $printer"
}
