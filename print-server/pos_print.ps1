$logFile = "print.log"
function Log($msg) { Add-Content $logFile "$(Get-Date -Format 'HH:mm:ss') - $msg" }

$jsonPath = $args[0]
Log "Starting print job with JSON: $jsonPath"
if (-not $jsonPath) { Log "ERROR: No JSON path provided"; exit 1 }

$d = Get-Content $jsonPath | ConvertFrom-Json
if (-not $d) { Log "ERROR: Failed to parse JSON"; exit 1 }

Add-Type -AssemblyName System.Drawing

function Logo([string]$path) {
    Log "Processing logo: $path"
    if (-not (Test-Path $path)) { 
        Log "LOGO NOT FOUND: $path"
        $msg = [System.Text.Encoding]::ASCII.GetBytes("LOGO NOT FOUND: $path`n")
        return [byte[]](0x1B, 0x61, 0x01) + $msg 
    }
    try {
        $img = [System.Drawing.Image]::FromFile($path)
        Log "Image loaded: $($img.Width)x$($img.Height)"
        
        $maxW = 320
        $pw = $img.Width
        $ph = $img.Height
        
        if ($pw -gt $maxW) {
            $ph = [int]([Math]::Round($ph * ($maxW / $pw)))
            $pw = $maxW
        }
        
        if (($pw % 8) -ne 0) { $pw = [int]([Math]::Ceiling($pw / 8) * 8) }
        
        $bmp = New-Object System.Drawing.Bitmap $pw,$ph
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gfx.Clear([System.Drawing.Color]::White)
        $gfx.DrawImage($img, 0, 0, $pw, $ph)
        $gfx.Dispose(); $img.Dispose()
        
        $widthBytes = $pw / 8
        $xL = [byte]($widthBytes % 256); $xH = [byte]([Math]::Floor($widthBytes / 256))
        $yL = [byte]($ph % 256); $yH = [byte]([Math]::Floor($ph / 256))
        
        # Standard GS v 0 command
        [byte[]]$hdr = @(0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH)
        $body = New-Object byte[] ($widthBytes * $ph)
        $idx = 0
        
        for ($row = 0; $row -lt $ph; $row++) {
            for ($col = 0; $col -lt $pw; $col += 8) {
                $byte = 0
                for ($bit = 0; $bit -lt 8; $bit++) {
                    if ($col + $bit -lt $pw) {
                        $px = $bmp.GetPixel($col + $bit, $row)
                        if ($px.R -lt 200 -or $px.G -lt 200 -or $px.B -lt 200) { 
                            $byte = $byte -bor (1 -shl (7 - $bit)) 
                        }
                    }
                }
                $body[$idx++] = [byte]$byte
            }
        }
        
        $bmp.Dispose()
        return $hdr + $body + [byte[]](0x0A)
    } catch {
        Log "LOGO ERR: $_"
        $msg = [System.Text.Encoding]::ASCII.GetBytes("LOGO ERR: $_`n")
        return [byte[]](0x1B, 0x61, 0x01) + $msg
    }
}

function QR([string]$text) {
    if (-not $text) { return [byte[]]@() }
    Log "Generating QR for: $text"
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

[byte[]]$full = @()
if ($d.labelFiles) {
    Log "Label Job: $($d.labelFiles.Count) files"
    $full += [byte[]](0x1B, 0x40)
    for ($c=0; $c -lt $d.copies; $c++) {
        foreach ($file in $d.labelFiles) {
            $full += Logo $file
            $full += [byte[]](0x0A)
        }
    }
    if ($d.cut) {
        $full += [byte[]](0x1B, 0x64, 0x05, 0x1D, 0x56, 0x01)
    }
} else {
    Log "Receipt Job"
    [byte[]]$part1 = [Convert]::FromBase64String($d.part1)
    [byte[]]$part2 = [Convert]::FromBase64String($d.part2)
    [byte[]]$post  = [Convert]::FromBase64String($d.post)
    [byte[]]$logo  = @()
    if ($d.logoBits) {
        Log "Using pre-processed logo bits from browser"
        # Ensure center alignment even for pre-processed bits
        $logo = [byte[]](0x1B, 0x61, 0x01) + [Convert]::FromBase64String($d.logoBits)
    } else {
        $logo = Logo $d.logo
    }
    
    [byte[]]$qr    = QR $d.qr
    $full = $part1 + $logo + $part2 + $qr + $post
}

Log "Total bytes to send: $($full.Length)"
$printer = $d.printer
try {
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
    Add-Type -TypeDefinition $rawDef -ErrorAction SilentlyContinue
    $h = [IntPtr]::Zero
    $di = New-Object WP2+DI; $di.pDocName = 'PrintJob'; $di.pDataType = 'RAW'
    if ([WP2]::OpenPrinter($printer,[ref]$h,[IntPtr]::Zero)) {
        [WP2]::StartDocPrinter($h,1,$di) | Out-Null
        [WP2]::StartPagePrinter($h) | Out-Null
        $chunkSz = 1024
        for ($i=0; $i -lt $full.Length; $i += $chunkSz) {
            $take = [Math]::Min($chunkSz, $full.Length - $i)
            $slice = New-Object byte[] $take
            [Buffer]::BlockCopy($full,$i,$slice,0,$take)
            $ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($take)
            [System.Runtime.InteropServices.Marshal]::Copy($slice,0,$ptr,$take)
            $wr = 0; [WP2]::WritePrinter($h,$ptr,$take,[ref]$wr) | Out-Null
            [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
        }
        [WP2]::EndPagePrinter($h) | Out-Null
        [WP2]::EndDocPrinter($h) | Out-Null
        [WP2]::ClosePrinter($h) | Out-Null
        Log "Sent to $($printer): OK"
        Write-Host "Sent to $($printer): OK"
    } else {
        throw "Could not open printer $($printer)"
    }
} catch {
    Log "Print failed: $_"
    Write-Host "Print failed: $_"
    exit 1
}
