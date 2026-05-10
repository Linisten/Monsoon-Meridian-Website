$logFile = "print.log"
function Log($msg) { Add-Content $logFile "$(Get-Date -Format 'HH:mm:ss') - $msg" }

$jsonPath = $args[0]
if (-not $jsonPath) { exit 1 }

try {
    $d = Get-Content $jsonPath -Raw | ConvertFrom-Json
} catch {
    Log "JSON ERROR: $_"; exit 1
}

function Logo([string]$path) {
    if (-not (Test-Path $path)) { return [byte[]]@() }
    try {
        Add-Type -AssemblyName System.Drawing
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

# Use a Generic List[byte] to avoid PowerShell array nesting issues
$buffer = New-Object System.Collections.Generic.List[byte]

if ($d.labelFiles) {
    $buffer.AddRange([byte[]](0x1B, 0x40))
    foreach ($f in $d.labelFiles) { $buffer.AddRange((Logo $f)); $buffer.Add(0x0A) }
} else {
    $buffer.AddRange([Convert]::FromBase64String($d.part1))
    if ($d.logoBits) {
        Log "Using browser bits"
        $buffer.AddRange([Convert]::FromBase64String($d.logoBits))
    } else {
        $buffer.AddRange((Logo $d.logo))
    }
    $buffer.AddRange([Convert]::FromBase64String($d.part2))
    $buffer.AddRange((QR $d.qr))
    $buffer.AddRange([Convert]::FromBase64String($d.post))
}

$finalBytes = $buffer.ToArray()

$printer = $d.printer
if (-not $printer) { 
    $def = Get-Printer | Where-Object IsDefault -eq $true
    $printer = $def.Name
}

# Raw Spooler Helper
$rawCode = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DI {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DI di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static void Send(string name, byte[] data) {
        IntPtr h = new IntPtr(0);
        DI di = new DI(); di.pDocName = "Monsoon POS"; di.pDataType = "RAW";
        if (OpenPrinter(name, out h, IntPtr.Zero)) {
            if (StartDocPrinter(h, 1, di) != 0) {
                if (StartPagePrinter(h)) {
                    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data, 0, p, data.Length);
                    Int32 w = 0;
                    WritePrinter(h, p, data.Length, out w);
                    EndPagePrinter(h);
                    Marshal.FreeCoTaskMem(p);
                }
                EndDocPrinter(h);
            }
            ClosePrinter(h);
        }
    }
}
"@

Add-Type -TypeDefinition $rawCode -ErrorAction SilentlyContinue
Log "Spooling $($finalBytes.Length) bytes to $printer"
[RawPrinter]::Send($printer, $finalBytes)
Log "Done."
