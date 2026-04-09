$printer = "POS-80"

$rawDef = @"
using System;
using System.Runtime.InteropServices;
public class PR {
    [DllImport("winspool.drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr p);
    [DllImport("winspool.drv",EntryPoint="StartDocPrinterA",SetLastError=true,CharSet=CharSet.Ansi)]
    public static extern uint StartDocPrinter(IntPtr h, Int32 lvl, [In] DI di);
    [DllImport("winspool.drv",EntryPoint="StartPagePrinter",SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv",EntryPoint="WritePrinter",SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, Int32 n, out Int32 w);
    [DllImport("winspool.drv",EntryPoint="EndPagePrinter",SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
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

[byte[]]$data = @(
    0x1B, 0x40,         # INIT
    0x1B, 0x61, 0x01,   # Center
    0x1B, 0x45, 0x01    # Bold
) + [System.Text.Encoding]::ASCII.GetBytes("SPOOLER PAGE TEST`n") + @(
    0x1B, 0x45, 0x00, 0x1B, 0x61, 0x00
) + [System.Text.Encoding]::ASCII.GetBytes("With StartPage/EndPage`n`n") + @(
    0x1B, 0x64, 0x05,   # Feed 5
    0x1D, 0x56, 0x01    # Cut
)

$h = [IntPtr]::Zero
$di = New-Object PR+DI
$di.pDocName = "TestPage"
$di.pDataType = "RAW"

$opened = [PR]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero)
Write-Host "Open: $opened"

$docId = [PR]::StartDocPrinter($h, 1, $di)
Write-Host "StartDoc: $docId"

$pg = [PR]::StartPagePrinter($h)
Write-Host "StartPage: $pg"

$ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($data.Length)
[System.Runtime.InteropServices.Marshal]::Copy($data, 0, $ptr, $data.Length)
$wr = 0
$wok = [PR]::WritePrinter($h, $ptr, $data.Length, [ref]$wr)
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
Write-Host "WritePrinter: $wok, wrote $wr"

$ep = [PR]::EndPagePrinter($h)
Write-Host "EndPage: $ep"

[PR]::EndDocPrinter($h) | Out-Null
[PR]::ClosePrinter($h) | Out-Null
Write-Host "Done"
