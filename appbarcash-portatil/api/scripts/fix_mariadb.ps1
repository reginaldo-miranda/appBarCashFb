$iniPath = "D:\regi\mariadb\data\my.ini"
$batPath = "D:\regi\mariadb\iniciar_mariadb.bat"

# 1. Ajustar my.ini
try {
    $content = Get-Content $iniPath -ErrorAction Stop
    $newContent = $content -replace "datadir=D:/regi/mariadb/data", "datadir=D:/regi/mariadb/data_portable"
    $newContent | Set-Content $iniPath -Encoding UTF8
    Write-Host "my.ini atualizado."
} catch {
    Write-Error "Erro ao atualizar my.ini: $_"
}

# 2. Criar .bat
$batContent = @"
@echo off
echo Iniciando MariaDB Portatil na porta 3307...
cd /d "D:\regi\mariadb"
bin\mysqld.exe --defaults-file="data\my.ini" --console
pause
"@

try {
    $batContent | Set-Content $batPath -Encoding ASCII
    Write-Host "iniciar_mariadb.bat criado."
} catch {
    Write-Error "Erro ao criar .bat: $_"
}
