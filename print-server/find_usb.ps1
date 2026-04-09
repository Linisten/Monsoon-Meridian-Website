Get-PnpDevice -Class "USB" | Where-Object { $_.Status -eq "OK" } | Select-Object FriendlyName, DeviceID | Format-List
