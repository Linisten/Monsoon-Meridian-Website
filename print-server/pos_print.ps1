$logFile = "print.log"
function Log($msg) { Add-Content $logFile "$(Get-Date -Format 'HH:mm:ss') - $msg" }

$jsonPath = $args[0]
Log "Starting print job with JSON: $jsonPath"
if (-not $jsonPath) { Log "ERROR: No JSON path provided"; exit 1 }

try {
    $d = Get-Content $jsonPath -Raw | ConvertFrom-Json
    if (-not $d) { throw "Failed to parse JSON" }
} catch {
    Log "FATAL JSON ERROR: $_"
    exit 1
}

Add-Type -AssemblyName System.Drawing

function Logo([string]$path) {
    if (-not (Test-Path $path)) { return [byte[]]@() }
    try {
        $img = [System.Drawing.Image]::FromFile($path)
        $maxW = 384
        $pw = $img.Width; $ph = $img.Height
        if ($pw -gt $maxW) { $ph = [int]([Math]::Round($ph * ($maxW / $pw))); $pw = $maxW }
        if (($pw % 8) -ne 0) { $pw = [int]([Math]::Ceiling($pw / 8) * 8) }
        $bmp = New-Object System.Drawing.Bitmap $pw,$ph
        $gfx = [System.Drawing.Graphics]::FromImage($bmp); $gfx.Clear([System.Drawing.Color]::White)
        $gfx.DrawImage($img, 0, 0, $pw, $ph); $gfx.Dispose(); $img.Dispose()
        $widthBytes = $pw / 8
        $xL = [byte]($widthBytes % 256); $xH = [byte]([Math]::Floor($widthBytes / 256))
        $yL = [byte]($ph % 256); $yH = [byte]([Math]::Floor($ph / 256))
        [byte[]]$hdr = @(0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH)
        $body = New-Object byte[] ($widthBytes * $ph); $idx = 0
        for ($row = 0; $row -lt $ph; $row++) {
            for ($col = 0; $col -lt $pw; $col += 8) {
                $byte = 0
                for ($bit = 0; $bit -lt 8; $bit++) {
                    if ($col + $bit -lt $pw) {
                        $px = $bmp.GetPixel($col + $bit, $row)
                        if ($px.R -lt 200 -or $px.G -lt 200 -or $px.B -lt 200) { $byte = $byte -bor (1 -shl (7 - $bit)) }
                    }
                }
                $body[$idx++] = [byte]$byte
            }
        }
        $bmp.Dispose()
        return $hdr + $body + [byte[]](0x0A)
    } catch { return [byte[]]@() }
}

function QR([string]$text) {
    if (-not $text) { return [byte[]]@() }
    $txt = [System.Text.Encoding]::ASCII.GetBytes($text)
    $pL = [byte](($txt.Length + 3) % 256); $pH = [byte]([Math]::Floor(($txt.Length + 3) / 256))
    return [byte[]](0x1B,0x61,0x01,0x1D,0x28,0x6B,4,0,49,65,50,0,0x1D,0x28,0x6B,3,0,49,67,8,0x1D,0x28,0x6B,3,0,49,69,48) + 
           [byte[]](@(0x1D,0x28,0x6B,$pL,$pH,49,80,48) + $txt) + [byte[]](0x1D,0x28,0x6B, 3,0, 49,81,48)
}

[byte[]]$full = @()
if ($d.labelFiles) {
    $full += [byte[]](0x1B, 0x40)
    foreach ($file in $d.labelFiles) { $full += Logo $file; $full += [byte[]](0x0A) }
} else {
    [byte[]]$logo = @()
    if ($d.logoBits) {
        Log "Using pre-processed logo bits from browser"
        $logo = [Convert]::FromBase64String($d.logoBits)
    } else { $logo = Logo $d.logo }
    $full = [Convert]::FromBase64String($d.part1) + $logo + [Convert]::FromBase64String($d.part2) + (QR $d.qr) + [Convert]::FromBase64String($d.post)
}

$printer = $d.printer
if (-not $printer) { 
    $def = Get-Printer | Where-Object IsDefault -eq $true
    $printer = $def.Name
    Log "Using Default: $printer"
}

# FINAL RAW PRINT C# HELPER
$rawCode = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool Send(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Monsoon POS Print"; di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                    Int32 dwWritten = 0;
                    WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return true;
    }
}
"@

Add-Type -TypeDefinition $rawCode -ErrorAction SilentlyContinue
Log "Spooling $($full.Length) bytes to $printer"
[RawPrinter]::Send($printer, $full)
Log "Done."
