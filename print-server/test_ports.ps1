Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class UsbPrint {
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern IntPtr CreateFile(string f, uint acc, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool WriteFile(IntPtr h, byte[] buf, uint n, out uint written, IntPtr ov);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    public const uint GENERIC_WRITE = 0x40000000;
    public const uint OPEN_EXISTING = 3;
}
"@

[byte[]]$testData = @(0x1B,0x40) + [System.Text.Encoding]::ASCII.GetBytes("USB DIRECT OK`n`n`n") + @(0x1B,0x64,0x03,0x1D,0x56,0x01)

# Try different paths
$paths = @(
    "\\.\USB001",
    "USB001",
    "\\.\LPT1",
    "\\.\LPT2"
)

foreach ($p in $paths) {
    $h = [UsbPrint]::CreateFile($p, [UsbPrint]::GENERIC_WRITE, 0, [IntPtr]::Zero, [UsbPrint]::OPEN_EXISTING, 0, [IntPtr]::Zero)
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($h -ne [IntPtr]::new(-1)) {
        Write-Host "SUCCESS with path: $p (handle=$h)"
        $w = 0
        $ok = [UsbPrint]::WriteFile($h, $testData, $testData.Length, [ref]$w, [IntPtr]::Zero)
        Write-Host "WriteFile: $ok, wrote $w bytes"
        [UsbPrint]::CloseHandle($h)
        break
    } else {
        Write-Host "FAIL $p - error $err"
    }
}
