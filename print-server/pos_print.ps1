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
    # SMART DISCOVERY: Look in several common places
    $searchPaths = @(
        $path,
        "src/assets/logo.jpg",
        "src/assets/logo.png",
        "public/logo.jpg",
        "../src/assets/logo.jpg",
        "../../src/assets/logo.jpg"
    )
    
    $finalPath = ""
    foreach ($p in $searchPaths) {
        if ($p -and (Test-Path $p)) { $finalPath = $p; break }
    }

    if ($finalPath -eq "") { 
        Log "LOGO NOT FOUND. Printing diagnostic 'M' shape."
        # DIAGNOSTIC: A small 16x16 black square as a "Graphic Heartbeat"
        [byte[]]$box = @(0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0, 2, 0, 16, 0)
        for($i=0; $i -lt 32; $i++) { $box += 0xFF }
        return $box + [byte[]](0x0A)
    }

    try {
        Add-Type -AssemblyName System.Drawing
        $img = [System.Drawing.Image]::FromFile((Resolve-Path $finalPath))
        
        # Temp bitmap to scan pixels for solid white margins
        $bmpTemp = New-Object System.Drawing.Bitmap $img
        
        # Auto-crop solid white borders from top
        $top = 0
        while ($top -lt $img.Height) {
            $rowIsWhite = $true
            for ($x = 0; $x -lt $img.Width; $x++) {
                $px = $bmpTemp.GetPixel($x, $top)
                if ($px.R -lt 240 -or $px.G -lt 240 -or $px.B -lt 240) {
                    $rowIsWhite = $false
                    break
                }
            }
            if (-not $rowIsWhite) { break }
            $top++
        }
        
        # Auto-crop solid white borders from bottom
        $bottom = $img.Height - 1
        while ($bottom -gt $top) {
            $rowIsWhite = $true
            for ($x = 0; $x -lt $img.Width; $x++) {
                $px = $bmpTemp.GetPixel($x, $bottom)
                if ($px.R -lt 240 -or $px.G -lt 240 -or $px.B -lt 240) {
                    $rowIsWhite = $false
                    break
                }
            }
            if (-not $rowIsWhite) { break }
            $bottom--
        }
        
        $croppedHeight = $bottom - $top + 1
        $bmpTemp.Dispose()
        
        # Scale to 480px wide (balanced size for 80mm printers)
        $pw = 480
        $ph = [int]([Math]::Round($croppedHeight * ($pw / $img.Width)))
        if (($pw % 8) -ne 0) { $pw = [int]([Math]::Ceiling($pw / 8) * 8) }
        
        $bmp = New-Object System.Drawing.Bitmap $pw,$ph
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.Clear([System.Drawing.Color]::White) # Clear to white to avoid transparency issues
        $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        # Draw only the cropped rectangle
        $srcRect = New-Object System.Drawing.Rectangle 0, $top, $img.Width, $croppedHeight
        $destRect = New-Object System.Drawing.Rectangle 0, 0, $pw, $ph
        $gfx.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $gfx.Dispose(); $img.Dispose()
        
        $widthBytes = $pw / 8
        $xL = [byte]($widthBytes % 256); $xH = [byte]([Math]::Floor($widthBytes / 256))
        $yL = [byte]($ph % 256); $yH = [byte]([Math]::Floor($ph / 256))
        
        # GS v 0 0 xL xH yL yH
        [byte[]]$hdr = @(0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH)
        $body = New-Object byte[] ($widthBytes * $ph)
        
        for ($row = 0; $row -lt $ph; $row++) {
            for ($col = 0; $col -lt $pw; $col += 8) {
                $byte = 0
                for ($bit = 0; $bit -lt 8; $bit++) {
                    if ($col + $bit -lt $pw) {
                        $px = $bmp.GetPixel($col + $bit, $row)
                        if ($px.A -ge 128 -and $px.R -lt 200) { 
                            $byte = $byte -bor (1 -shl (7 - $bit)) 
                        }
                    }
                }
                $body[($row * $widthBytes) + ($col / 8)] = [byte]$byte
            }
        }
        $bmp.Dispose()
        return $hdr + $body + [byte[]](0x0A) # Feed line after logo
    } catch { 
        Log "LOGO ERR: $_"
        return [byte[]](0x0A) + [System.Text.Encoding]::ASCII.GetBytes("LOGO ERR: $($_.Exception.Message)`n")
    }
}
 
function QR([string]$text) {
    if (-not $text) { return [byte[]]@() }
    $txt = [System.Text.Encoding]::ASCII.GetBytes($text)
    $pL = [byte](($txt.Length + 3) % 256)
    $pH = [byte]([Math]::Floor(($txt.Length + 3) / 256))
    return [byte[]](
        0x1B,0x61,0x01,
        0x1D,0x28,0x6B, 4,0, 49,65,50,0,
        0x1D,0x28,0x6B, 3,0, 49,67,4,     # Module size 4 (more compatible size)
        0x1D,0x28,0x6B, 3,0, 49,69,48
    ) + [byte[]](@(0x1D,0x28,0x6B,$pL,$pH,49,80,48) + $txt) +
      [byte[]](0x1D,0x28,0x6B, 3,0, 49,81,48) +
      [byte[]](0x0A)                      # Feed single line after QR
}

$buffer = New-Object System.Collections.Generic.List[byte]

if ($d.labelFiles) {
    $buffer.AddRange([byte[]](0x1B, 0x40))
    $repeatCount = 1
    if ($d.copies -and $d.copies -gt 0) { $repeatCount = [int]$d.copies }
    for ($i = 0; $i -lt $repeatCount; $i++) {
        foreach ($f in $d.labelFiles) { 
            foreach ($b in (Logo $f)) { $buffer.Add($b) }
            $buffer.Add(0x0A) 
        }
    }
} else {
    $buffer.AddRange([Convert]::FromBase64String($d.part1))
    
    if ($d.logoBits) {
        Log "Using browser bits"
        $buffer.AddRange([byte[]]$d.logoBits)
    } else {
        foreach ($b in (Logo $d.logo)) { $buffer.Add($b) }
    }
    
    $buffer.AddRange([Convert]::FromBase64String($d.part2))
    foreach ($b in (QR $d.qr)) { $buffer.Add($b) }
    $buffer.AddRange([Convert]::FromBase64String($d.post))
}

$finalBytes = $buffer.ToArray()

$printer = $d.printer
if (-not $printer) { 
    $def = Get-CimInstance Win32_Printer | Where-Object Default -eq $true
    $printer = $def.Name
}

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
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DI di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void Send(string name, byte[] data) {
        IntPtr h = new IntPtr(0);
        DI di = new DI(); di.pDocName = "Monsoon POS"; di.pDataType = "RAW";
        if (OpenPrinter(name, out h, IntPtr.Zero)) {
            if (StartDocPrinter(h, 1, di) != 0) {
                if (StartPagePrinter(h)) {
                    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data, 0, p, data.Length);
                    int w = 0;
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
