@echo off

REM === Lancer l'API Python (Uvicorn) ===
start "API Server" cmd /k ^
python\python-3.12.6.amd64\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000

REM === Lancer llama.cpp server ===
start "Llama Server" cmd /k ^
cd /d "llamacpp" ^& ^
llama-server -m qwen2.5-1.5b-instruct-q4_k_m-00001-of-00001.gguf -c 8192 -t 6 --host 127.0.0.1 --port 8033
