
$path = "D:\regi\mariadb\data\my.ini"
$content = Get-Content $path
$content | Set-Content $path -Encoding ASCII
Write-Host "Encoding corrigido para ASCII"
