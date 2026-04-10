$VBSPath = "C:\Users\Sk\mm\Monsoon-Meridian-Website\print-server\silent_launcher.vbs"
$StartupFolder = [System.Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder "MonsoonPrintServer.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $VBSPath
$Shortcut.WorkingDirectory = "C:\Users\Sk\mm\Monsoon-Meridian-Website\print-server"
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.IconLocation = "shell32.dll, 16" # Printer icon
$Shortcut.Save()

Write-Host "✅ Print Server added to Windows Startup at: $ShortcutPath" -ForegroundColor Green
