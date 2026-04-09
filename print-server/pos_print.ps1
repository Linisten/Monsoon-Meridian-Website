Add-Type -AssemblyName System.Drawing

$jsonPath = $args[0]
$d = Get-Content $jsonPath | ConvertFrom-Json

function Logo([string]$path) {
    if (-not (Test-Path $path)) { Write-Host "Logo not found"; return [byte[]]@() }
    $img = [System.Drawing.Image]::FromFile($path)
    $pw = 384; $ph = [int]($img.Height * $pw / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap $pw,$ph
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.DrawImage($img, 0, 0, $pw, $ph)
    $gfx.Dispose(); $img.Dispose()
    $xL = [byte]($pw / 8); $xH = [byte](0)
    $yL = [byte]($ph % 256); $yH = [byte]([Math]::Floor($ph / 256))
    $hdr = [byte[]](0x1B,0x61,0x01, 0x1D,0x76,0x30,0x00, $xL,$xH,$yL,$yH)
    $body = New-Object byte[] ($pw/8 * $ph)
    $idx = 0
    for ($row=0; $row -lt $ph; $row++) {
        for ($col=0; $col -lt $pw; $col+=8) {
            $byte = 0
            for ($bit=0; $bit -lt 8; $bit++) {
                $px = $bmp.GetPixel($col+$bit, $row)
                if ($px.GetBrightness() -lt 0.71) { $byte = $byte -bor (1 -shl (7-$bit)) }
            }
            $body[$idx++] = [byte]$byte
        }
    }
    $bmp.Dispose()
    Write-Host "Logo: $($pw)x$($ph) = $($hdr.Length+$body.Length) bytes"
    return [byte[]]($hdr + $body)
}

function QR([string]$text) {
    $txt = [System.Text.Encoding]::ASCII.GetBytes($text)
    $pL = [byte](($txt.Length + 3) % 256)
    $pH = [byte]([Math]::Floor(($txt.Length + 3) / 256))
    return [byte[]](
        0x1B,0x61,0x01,
        0x1D,0x28,0x6B, 4,0, 49,65,50,0,
        0x1D,0x28,0x6B, 3,0, 49,67,8,
        0x1D,0x28,0x6B, 3,0, 49,69,48
    ) + [byte[]](@(0x1D,0x28,0x6B,$pL,$pH,49,80,48) + $txt) +
      [byte[]](0x1D,0x28,0x6B, 3,0, 49,81,48)
}

[byte[]]$part1 = [Convert]::FromBase64String($d.part1)
[byte[]]$part2 = [Convert]::FromBase64String($d.part2)
[byte[]]$post  = [Convert]::FromBase64String($d.post)
[byte[]]$logo  = Logo $d.logo
[byte[]]$qr    = QR $d.qr
[byte[]]$full  = $part1 + $logo + $part2 + $qr + $post

Write-Host "Total: $($full.Length) bytes"

# Write directly to USB printer port - bypasses Windows GDI driver
$port = "USB001"
try {
    $stream = [System.IO.File]::Open("\\.\$port", [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    $stream.Write($full, 0, $full.Length)
    $stream.Flush()
    $stream.Close()
    Write-Host "Direct USB write: OK"
} catch {
    Write-Host "Direct USB failed: $_"
    Write-Host "Falling back to spooler..."
    
    # Fallback: spooler RAW
    $rawDef = @"
using System;
using System.Runtime.InteropServices;
public class WP2 {
    [DllImport("winspool.drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr p);
    [DllImport("winspool.drv",EntryPoint="StartDocPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
    public static extern uint StartDocPrinter(IntPtr h, Int32 lvl, [In] DI di);
    [DllImport("winspool.drv",EntryPoint="StartPagePrinter",SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv",EntryPoint="WritePrinter",SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, Int32 n, out Int32 w);
    [DllImport("winspool.drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv",EntryPoint="ClosePrinter")]  public static extern bool ClosePrinter(IntPtr h);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
    public class DI {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
}
"@
    Add-Type -TypeDefinition $rawDef
    $h = [IntPtr]::Zero
    $di = New-Object WP2+DI; $di.pDocName = 'Receipt'; $di.pDataType = 'RAW'
    [WP2]::OpenPrinter($d.printer,[ref]$h,[IntPtr]::Zero) | Out-Null
    [WP2]::StartDocPrinter($h,1,$di) | Out-Null
    $chunkSz = 1024
    for ($i=0; $i -lt $full.Length; $i += $chunkSz) {
        $take = [Math]::Min($chunkSz, $full.Length - $i)
        $slice = New-Object byte[] $take
        [Buffer]::BlockCopy($full,$i,$slice,0,$take)
        $ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($take)
        [System.Runtime.InteropServices.Marshal]::Copy($slice,0,$ptr,$take)
        $wr = 0; [WP2]::WritePrinter($h,$ptr,$take,[ref]$wr) | Out-Null
        [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
        Start-Sleep -Milliseconds 20
    }
    [WP2]::EndDocPrinter($h) | Out-Null
    [WP2]::ClosePrinter($h) | Out-Null
    Write-Host "Spooler fallback: done"
}
