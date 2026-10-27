@echo off
REM CMD native wrapper for Parallax Studio V2 MCP CLI Controller
node "%~dp0mcp-server\cli.mjs" %*
exit /b %ERRORLEVEL%
