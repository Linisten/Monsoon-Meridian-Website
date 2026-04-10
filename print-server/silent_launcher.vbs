Set WshShell = CreateObject("WScript.Shell")
' Run the batch file in hidden mode (0)
WshShell.Run Chr(34) & "C:\Users\Sk\mm\Monsoon-Meridian-Website\print-server\start_monsoon_server.bat" & Chr(34), 0
Set WshShell = Nothing
