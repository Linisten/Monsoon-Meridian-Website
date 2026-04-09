$id = "USB\VID_0418&PID_5011"
$dev = Get-PnpDevice | Where-Object { $_.DeviceID -like "$id*" }
Write-Host "Device: $($dev.FriendlyName)"
Write-Host "DeviceID: $($dev.DeviceID)"

# Get device interface paths for this device  
$devInterfaces = Get-PnpDeviceProperty -InstanceId $dev.DeviceID -KeyName "DEVPKEY_Device_Children" -ErrorAction SilentlyContinue
Write-Host "Children: $($devInterfaces.Data)"

# Try to find the printer device interface (GUID_DEVINTERFACE_USBPRINT)
$usbprintGuid = "{28D78FAD-5A12-11D1-AE5B-0000F803A8C2}"
$interfaces = Get-PnpDevice | Where-Object { $_.DeviceID -like "USB\VID_0418*" }
foreach ($i in $interfaces) {
    Write-Host "Found: $($i.DeviceID) - $($i.FriendlyName) - $($i.Class)"
}
