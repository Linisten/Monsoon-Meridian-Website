# Create a standard TCP/IP RAW port on 127.0.0.1:9100 and redirect it to the USB printer
# This lets us bypass the Epson Dynamic Print Monitor

# Step 1: Add a Standard TCP/IP Port
$portName = "POS80_RAW"
$existingPort = Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue
if (-not $existingPort) {
    Write-Host "Creating RAW TCP port $portName..."
    Add-PrinterPort -Name $portName -PrinterHostAddress "127.0.0.1" -PortNumber 9100 -ErrorAction SilentlyContinue
    Write-Host "Port created."
} else {
    Write-Host "Port $portName already exists."
}

# Step 2: Check all available ports to confirm
Get-PrinterPort | Select-Object Name, Description | Format-Table -AutoSize
