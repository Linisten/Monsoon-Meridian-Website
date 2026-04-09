Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class UsbPrint {
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern IntPtr CreateFile(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool WriteFile(IntPtr hFile, byte[] lpBuffer, uint nNumberOfBytesToWrite, out uint lpNumberOfBytesWritten, IntPtr lpOverlapped);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool CloseHandle(IntPtr hObject);

    public const uint GENERIC_WRITE = 0x40000000;
    public const uint FILE_SHARE_READ = 0x00000001;
    public const uint OPEN_EXISTING = 3;
}
"@

# Test: write hello world to printer device interface
$devicePath = "\\.\USBPRINT#Printer:CMD:EPSONPOS-80:CLS:PRINTER:1#6&33178f98&0&USB001#{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"

[byte[]]$testData = @(
    0x1B, 0x40,              # INIT
    0x1B, 0x61, 0x01,        # Center
    0x1B, 0x45, 0x01         # Bold
) + [System.Text.Encoding]::ASCII.GetBytes("DIRECT USB TEST`n") + @(
    0x1B, 0x45, 0x00,
    0x1B, 0x61, 0x00
) + [System.Text.Encoding]::ASCII.GetBytes("If you see this, direct USB works!`n`n`n") + @(
    0x1B, 0x64, 0x03,
    0x1D, 0x56, 0x01
)

Write-Host "Trying device path: $devicePath"
$h = [UsbPrint]::CreateFile($devicePath, [UsbPrint]::GENERIC_WRITE, [UsbPrint]::FILE_SHARE_READ, [IntPtr]::Zero, [UsbPrint]::OPEN_EXISTING, 0, [IntPtr]::Zero)
$err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()

if ($h -eq [IntPtr]::new(-1)) {
    Write-Host "CreateFile FAILED, error: $err"
} else {
    Write-Host "CreateFile OK: $h"
    $written = 0
    $ok = [UsbPrint]::WriteFile($h, $testData, $testData.Length, [ref]$written, [IntPtr]::Zero)
    Write-Host "WriteFile: $ok, wrote $written bytes"
    [UsbPrint]::CloseHandle($h) | Out-Null
    Write-Host "Done"
}
