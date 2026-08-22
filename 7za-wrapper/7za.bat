@echo off
"D:\abyte-desk\server-app\node_modules\7zip-bin\win\x64\7za.exe" %*
if %ERRORLEVEL% EQU 2 exit /b 0
exit /b %ERRORLEVEL%
