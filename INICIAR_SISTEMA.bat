@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================================
echo   SACS / SEAL - Sistema de Atencion al Cliente (PostgreSQL + Node.js)
echo ============================================================================
echo.

echo [1/4] Verificando servicio PostgreSQL (postgresql-x64-14)...
sc query postgresql-x64-14 | find "RUNNING" >nul
if errorlevel 1 (
    echo     Iniciando servicio postgresql-x64-14...
    net start postgresql-x64-14
) else (
    echo     PostgreSQL 14 esta activo y corriendo en el puerto 5432.
)

echo.
echo [2/4] Verificando e inicializando Base de Datos PostgreSQL (sacs_atencion)...
call npm run db:init
if errorlevel 1 (
    echo [ERROR] No se pudo inicializar PostgreSQL. Verifique .env o el servicio.
    pause
    exit /b 1
)

echo.
echo [3/4] Compilando servidor TypeScript...
call npm run build
if errorlevel 1 (
    echo [ERROR] Error al compilar el proyecto.
    pause
    exit /b 1
)

echo.
echo [4/4] Iniciando servidor SACS en http://localhost:3000 ...
echo     Credencial recomendada: ADMIN / ADMIN
echo     (Presione Ctrl+C para detener el servidor al finalizar la presentacion)
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000/login.html"
call npm start
pause
