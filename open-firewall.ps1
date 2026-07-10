# Open Windows Firewall ports for COC Clan Hub dev servers
# Run this ONCE in PowerShell as Administrator

Write-Host "🔓 Opening Windows Firewall for COC Clan Hub..." -ForegroundColor Yellow

# Vite dev server (frontend)
New-NetFirewallRule -DisplayName "COC Vite Dev Server" `
  -Direction Inbound -LocalPort 5173 -Protocol TCP `
  -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null

# Backend Express server
New-NetFirewallRule -DisplayName "COC Backend API" `
  -Direction Inbound -LocalPort 5000 -Protocol TCP `
  -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null

Write-Host "✓ Ports 5173 (Vite) and 5000 (Backend) are now open" -ForegroundColor Green

# Show current LAN IP
Write-Host "`n🌐 Your LAN IP address(es):" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback|VMware|VirtualBox' -and $_.IPAddress -notlike '169.*' } |
  ForEach-Object { Write-Host "   $($_.IPAddress)  ($($_.InterfaceAlias))" }

Write-Host "`nTest from your phone: http://YOUR_IP:5173" -ForegroundColor Yellow
Write-Host "(Both desktop and phone must be on the same WiFi)" -ForegroundColor Gray
