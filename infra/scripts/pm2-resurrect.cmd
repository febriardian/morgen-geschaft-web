@echo off
set "PM2_HOME=C:\Users\Axioo\.pm2"

call "C:\Users\Axioo\AppData\Roaming\npm\pm2.cmd" resurrect >> "C:\Users\Axioo\.pm2\startup.log" 2>&1

set "PM2_EXIT_CODE=%ERRORLEVEL%"
exit /b %PM2_EXIT_CODE%