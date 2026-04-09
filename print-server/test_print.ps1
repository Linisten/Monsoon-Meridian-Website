$printer = "POS-80"

$rawDef = @"
using System;
using System.Runtime.InteropServices;
public class TestPrint {
    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr p);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern uint StartDocPrinter(IntPtr h, Int32 lvl, [In] DI di);
    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, Int32 n, out Int32 w);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DI {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
}
"@
Add-Type -TypeDefinition $rawDef

# Simple test: INIT + text + feed + cut
[byte[]]$data = @(
    0x1B, 0x40,              # INIT
    0x1B, 0x61, 0x01,        # Center align
    0x1B, 0x45, 0x01         # Bold on
) + [System.Text.Encoding]::ASCII.GetBytes("MONSOON MERIDIAN`n") + @(
    0x1B, 0x45, 0x00,        # Bold off
    0x1B, 0x61, 0x00         # Left align
) + [System.Text.Encoding]::ASCII.GetBytes("Print test OK`n`n`n") + @(
    0x1B, 0x64, 0x03,        # Feed 3 lines
    0x1D, 0x56, 0x01         # Cut
)

Write-Host "Sending $($data.Length) bytes to $printer"

$h = [IntPtr]::Zero
$di = New-Object TestPrint+DI
$di.pDocName = "Test"; $di.pDataType = "RAW"

$opened = [TestPrint]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero)
Write-Host "OpenPrinter: $opened"
if (-not $opened) { Write-Host "FAILED to open printer"; exit 1 }

$docId = [TestPrint]::StartDocPrinter($h, 1, $di)
Write-Host "StartDoc: $docId"
if ($docId -eq 0) { Write-Host "FAILED StartDoc"; [TestPrint]::ClosePrinter($h); exit 1 }

$ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($data.Length)
[System.Runtime.InteropServices.Marshal]::Copy($data, 0, $ptr, $data.Length)
$written = 0
$ok = [TestPrint]::WritePrinter($h, $ptr, $data.Length, [ref]$written)
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
Write-Host "WritePrinter: $ok, wrote $written bytes"

[TestPrint]::EndDocPrinter($h) | Out-Null
[TestPrint]::ClosePrinter($h) | Out-Null
Write-Host "Done"
