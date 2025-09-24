#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для быстрого запуска приложения просмотрщика тест-кейсов
"""

import os
import sys
import subprocess

def check_python_version():
    """Проверка версии Python"""
    if sys.version_info < (3, 7):
        print("❌ Требуется Python 3.7 или выше")
        print(f"Текущая версия: {sys.version}")
        return False
    print(f"✅ Python версия: {sys.version.split()[0]}")
    return True

def check_dependencies():
    """Проверка установленных зависимостей"""
    try:
        import flask
        import flask_cors
        print("✅ Зависимости установлены")
        return True
    except ImportError:
        print("❌ Зависимости не установлены")
        return False

def install_dependencies():
    """Установка зависимостей"""
    print("📦 Установка зависимостей...")
    try:
        subprocess.check_call(["python3", "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Зависимости установлены успешно")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка установки зависимостей: {e}")
        return False

def check_test_cases_dir():
    """Проверка наличия директории с тест-кейсами"""
    if not os.path.exists("test_cases"):
        print("❌ Директория test_cases не найдена")
        return False
    
    json_files = [f for f in os.listdir("test_cases") if f.endswith('.json')]
    if not json_files:
        print("⚠️  В директории test_cases нет JSON файлов")
    else:
        print(f"✅ Найдено {len(json_files)} JSON файлов в test_cases")
    
    return True

def run_app():
    """Запуск приложения"""
    print("🚀 Запуск приложения...")
    print("⏹️  Для остановки нажмите Ctrl+C")
    print("-" * 50)
    
    try:
        from app import app, find_free_port
        
        # Пытаемся найти свободный порт
        port = find_free_port()
        if port is None:
            print("❌ Не удалось найти свободный порт в диапазоне 5001-5010")
            print("💡 Попробуйте закрыть другие приложения или изменить порт вручную")
            return
        
        print(f"📱 Откройте браузер: http://localhost:{port}")
        app.run(debug=True, host='0.0.0.0', port=port)
        
    except KeyboardInterrupt:
        print("\n👋 Приложение остановлено")
    except Exception as e:
        print(f"❌ Ошибка запуска: {e}")

def main():
    """Основная функция"""
    print("🔧 Просмотрщик тест-кейсов - Проверка и запуск")
    print("=" * 50)
    
    # Проверка версии Python
    if not check_python_version():
        sys.exit(1)
    
    # Проверка директории с тест-кейсами
    if not check_test_cases_dir():
        sys.exit(1)
    
    # Проверка зависимостей
    if not check_dependencies():
        print("📦 Попытка установки зависимостей...")
        if not install_dependencies():
            print("❌ Не удалось установить зависимости")
            print("💡 Попробуйте выполнить: pip install -r requirements.txt")
            sys.exit(1)
    
    # Запуск приложения
    run_app()

if __name__ == "__main__":
    main()
