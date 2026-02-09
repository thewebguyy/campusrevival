# PowerShell Script to setup Git
Write-Host "Setting up Git for CRM..."
git add .
git commit -m "Organize project: Frontend and Backend separation"
git branch -M main
Write-Host "Code committed. You can now push to GitHub:"
Write-Host "git push -u origin main"
