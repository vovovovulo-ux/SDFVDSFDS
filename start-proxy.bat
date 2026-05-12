@echo off
echo Запуск Pocket Option Proxy Server...
cd /d %~dp0
call npm install ws
node proxy-server.js
pause
