@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
  py -m venv .venv
)
call .venv\Scripts\activate
python -m pip install -r requirements.txt
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Створи файл .env та додай OPENAI_API_KEY.
  notepad .env
  pause
)
python server.py
pause
