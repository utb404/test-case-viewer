#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import glob
import socket
import uuid
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Путь к директории с тест-кейсами
TEST_CASES_DIR = os.path.join(os.path.dirname(__file__), 'test_cases')

def load_test_cases_recursive(directory):
    """
    Рекурсивно загружает все JSON файлы из директории и её поддиректорий
    """
    test_cases = []
    file_structure = {}
    
    # Получаем все JSON файлы рекурсивно
    json_files = glob.glob(os.path.join(directory, '**', '*.json'), recursive=True)
    
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Определяем относительный путь для структуры файлов
            rel_path = os.path.relpath(file_path, directory)
            path_parts = rel_path.split(os.sep)
            
            # Создаем структуру папок
            current_level = file_structure
            for part in path_parts[:-1]:  # Все части кроме имени файла
                if part not in current_level:
                    current_level[part] = {'type': 'folder', 'children': {}}
                current_level = current_level[part]['children']
            
            # Добавляем файл
            filename = path_parts[-1]
            current_level[filename] = {
                'type': 'file',
                'path': rel_path,
                'test_cases': []
            }
            
            # Обрабатываем содержимое файла
            if isinstance(data, list):
                # Если файл содержит массив тест-кейсов
                for test_case in data:
                    if isinstance(test_case, dict) and 'id' in test_case:
                        test_cases.append({
                            'file_path': rel_path,
                            'test_case': test_case
                        })
                        current_level[filename]['test_cases'].append(test_case['id'])
            elif isinstance(data, dict) and 'id' in data:
                # Если файл содержит один тест-кейс
                test_cases.append({
                    'file_path': rel_path,
                    'test_case': data
                })
                current_level[filename]['test_cases'].append(data['id'])
                
        except (json.JSONDecodeError, IOError) as e:
            print(f"Ошибка при загрузке файла {file_path}: {e}")
            continue
    
    return test_cases, file_structure

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/api/test-cases')
def get_test_cases():
    """API для получения всех тест-кейсов"""
    try:
        test_cases, file_structure = load_test_cases_recursive(TEST_CASES_DIR)
        return jsonify({
            'success': True,
            'test_cases': test_cases,
            'file_structure': file_structure
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-cases/search')
def search_test_cases():
    """API для поиска тест-кейсов"""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify({'success': True, 'results': []})
    
    try:
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        results = []
        
        for item in test_cases:
            test_case = item['test_case']
            # Поиск по id, title и тегам
            if (query in test_case.get('id', '').lower() or 
                query in test_case.get('title', '').lower() or
                any(query in tag.lower() for tag in test_case.get('tags', []))):
                results.append(item)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>')
def get_test_case_by_id(test_case_id):
    """API для получения конкретного тест-кейса по ID"""
    try:
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                return jsonify({
                    'success': True,
                    'test_case': item
                })
        
        return jsonify({
            'success': False,
            'error': 'Тест-кейс не найден'
        }), 404
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case', methods=['POST'])
def create_test_case():
    """API для создания нового тест-кейса"""
    try:
        data = request.get_json()
        
        # Валидация обязательных полей
        required_fields = ['title', 'author']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'error': f'Поле "{field}" обязательно для заполнения'
                }), 400
        
        # Генерируем ID если не указан
        if not data.get('id'):
            data['id'] = f"tc_{str(uuid.uuid4())[:8]}"
        
        # Проверяем уникальность ID
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        existing_ids = [tc['test_case']['id'] for tc in test_cases]
        if data['id'] in existing_ids:
            return jsonify({
                'success': False,
                'error': f'Тест-кейс с ID "{data["id"]}" уже существует'
            }), 400
        
        # Устанавливаем значения по умолчанию
        data.setdefault('status', 'Draft')
        data.setdefault('tags', [])
        data.setdefault('levels', [])
        data.setdefault('actions', [])
        data.setdefault('created_at', datetime.now().isoformat())
        data.setdefault('updated_at', datetime.now().isoformat())
        
        # Определяем файл для сохранения
        file_path = data.get('file_path', 'new_test_cases.json')
        if not file_path.endswith('.json'):
            file_path += '.json'
        
        full_file_path = os.path.join(TEST_CASES_DIR, file_path)
        
        # Загружаем существующие данные файла
        if os.path.exists(full_file_path):
            with open(full_file_path, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
        else:
            file_data = []
        
        # Добавляем новый тест-кейс
        if isinstance(file_data, list):
            file_data.append(data)
        else:
            file_data = [file_data, data]
        
        # Сохраняем файл
        with open(full_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'test_case': data,
            'file_path': file_path
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>', methods=['PUT'])
def update_test_case(test_case_id):
    """API для обновления тест-кейса"""
    try:
        data = request.get_json()
        
        # Находим тест-кейс
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        test_case_item = None
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                test_case_item = item
                break
        
        if not test_case_item:
            return jsonify({
                'success': False,
                'error': 'Тест-кейс не найден'
            }), 404
        
        # Обновляем данные
        updated_test_case = test_case_item['test_case'].copy()
        updated_test_case.update(data)
        updated_test_case['updated_at'] = datetime.now().isoformat()
        
        # Загружаем файл
        file_path = test_case_item['file_path']
        full_file_path = os.path.join(TEST_CASES_DIR, file_path)
        
        with open(full_file_path, 'r', encoding='utf-8') as f:
            file_data = json.load(f)
        
        # Обновляем тест-кейс в файле
        if isinstance(file_data, list):
            for i, tc in enumerate(file_data):
                if tc.get('id') == test_case_id:
                    file_data[i] = updated_test_case
                    break
        else:
            if file_data.get('id') == test_case_id:
                file_data = updated_test_case
        
        # Сохраняем файл
        with open(full_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'test_case': updated_test_case
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>', methods=['DELETE'])
def delete_test_case(test_case_id):
    """API для удаления тест-кейса"""
    try:
        # Находим тест-кейс
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        test_case_item = None
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                test_case_item = item
                break
        
        if not test_case_item:
            return jsonify({
                'success': False,
                'error': 'Тест-кейс не найден'
            }), 404
        
        # Загружаем файл
        file_path = test_case_item['file_path']
        full_file_path = os.path.join(TEST_CASES_DIR, file_path)
        
        with open(full_file_path, 'r', encoding='utf-8') as f:
            file_data = json.load(f)
        
        # Удаляем тест-кейс из файла
        if isinstance(file_data, list):
            file_data = [tc for tc in file_data if tc.get('id') != test_case_id]
            if len(file_data) == 0:
                # Если файл пустой, удаляем его
                os.remove(full_file_path)
                return jsonify({
                    'success': True,
                    'message': 'Тест-кейс удален, файл удален (был пустой)'
                })
        else:
            # Если в файле был только один тест-кейс, удаляем файл
            os.remove(full_file_path)
            return jsonify({
                'success': True,
                'message': 'Тест-кейс удален, файл удален'
            })
        
        # Сохраняем обновленный файл
        with open(full_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': 'Тест-кейс удален'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>/duplicate', methods=['POST'])
def duplicate_test_case(test_case_id):
    """API для дублирования тест-кейса"""
    try:
        # Находим оригинальный тест-кейс
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        original_item = None
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                original_item = item
                break
        
        if not original_item:
            return jsonify({
                'success': False,
                'error': 'Тест-кейс не найден'
            }), 404
        
        # Создаем копию
        duplicated_test_case = original_item['test_case'].copy()
        duplicated_test_case['id'] = f"tc_{str(uuid.uuid4())[:8]}"
        duplicated_test_case['title'] = f"{duplicated_test_case['title']} (копия)"
        duplicated_test_case['created_at'] = datetime.now().isoformat()
        duplicated_test_case['updated_at'] = datetime.now().isoformat()
        
        # Сохраняем в тот же файл
        file_path = original_item['file_path']
        full_file_path = os.path.join(TEST_CASES_DIR, file_path)
        
        with open(full_file_path, 'r', encoding='utf-8') as f:
            file_data = json.load(f)
        
        if isinstance(file_data, list):
            file_data.append(duplicated_test_case)
        else:
            file_data = [file_data, duplicated_test_case]
        
        with open(full_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'test_case': duplicated_test_case
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/directories', methods=['POST'])
def create_directory():
    """API для создания новой директории"""
    try:
        data = request.get_json()
        directory_name = data.get('name', '').strip()
        
        if not directory_name:
            return jsonify({
                'success': False,
                'error': 'Название директории обязательно'
            }), 400
        
        # Создаем директорию
        directory_path = os.path.join(TEST_CASES_DIR, directory_name)
        
        if os.path.exists(directory_path):
            return jsonify({
                'success': False,
                'error': 'Директория уже существует'
            }), 400
        
        os.makedirs(directory_path, exist_ok=True)
        
        return jsonify({
            'success': True,
            'message': f'Директория "{directory_name}" создана',
            'directory_name': directory_name
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>/move', methods=['PUT'])
def move_test_case(test_case_id):
    """API для перемещения тест-кейса в другую директорию/файл"""
    try:
        data = request.get_json()
        new_file_path = data.get('file_path', '').strip()
        
        if not new_file_path:
            return jsonify({
                'success': False,
                'error': 'Путь к файлу обязателен'
            }), 400
        
        # Находим тест-кейс
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        test_case_item = None
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                test_case_item = item
                break
        
        if not test_case_item:
            return jsonify({
                'success': False,
                'error': 'Тест-кейс не найден'
            }), 404
        
        # Удаляем тест-кейс из старого файла
        old_file_path = test_case_item['file_path']
        old_full_path = os.path.join(TEST_CASES_DIR, old_file_path)
        
        with open(old_full_path, 'r', encoding='utf-8') as f:
            old_file_data = json.load(f)
        
        # Удаляем тест-кейс из старого файла
        if isinstance(old_file_data, list):
            old_file_data = [tc for tc in old_file_data if tc.get('id') != test_case_id]
            if len(old_file_data) == 0:
                # Если файл пустой, удаляем его
                os.remove(old_full_path)
            else:
                # Сохраняем обновленный старый файл
                with open(old_full_path, 'w', encoding='utf-8') as f:
                    json.dump(old_file_data, f, ensure_ascii=False, indent=2)
        else:
            # Если в файле был только один тест-кейс, удаляем файл
            os.remove(old_full_path)
        
        # Добавляем тест-кейс в новый файл
        new_full_path = os.path.join(TEST_CASES_DIR, new_file_path)
        
        # Создаем директорию если не существует
        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
        
        # Загружаем или создаем новый файл
        if os.path.exists(new_full_path):
            with open(new_full_path, 'r', encoding='utf-8') as f:
                new_file_data = json.load(f)
        else:
            new_file_data = []
        
        # Добавляем тест-кейс
        if isinstance(new_file_data, list):
            new_file_data.append(test_case_item['test_case'])
        else:
            new_file_data = [new_file_data, test_case_item['test_case']]
        
        # Сохраняем новый файл
        with open(new_full_path, 'w', encoding='utf-8') as f:
            json.dump(new_file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': f'Тест-кейс перемещен в {new_file_path}',
            'new_file_path': new_file_path
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test-case/<test_case_id>/reorder-steps', methods=['PUT'])
def reorder_test_case_steps(test_case_id):
    """API для изменения порядка шагов в тест-кейсе"""
    try:
        data = request.get_json()
        new_steps = data.get('steps', [])
        
        if not isinstance(new_steps, list):
            return jsonify({
                'success': False,
                'error': 'Шаги должны быть массивом'
            }), 400
        
        # Находим тест-кейс
        test_cases, _ = load_test_cases_recursive(TEST_CASES_DIR)
        test_case_item = None
        for item in test_cases:
            if item['test_case']['id'] == test_case_id:
                test_case_item = item
                break
        
        if not test_case_item:
            return jsonify({
                'success': False,
                'error': 'Тест-кейс не найден'
            }), 404
        
        # Обновляем шаги
        updated_test_case = test_case_item['test_case'].copy()
        updated_test_case['actions'] = new_steps
        updated_test_case['updated_at'] = datetime.now().isoformat()
        
        # Загружаем файл
        file_path = test_case_item['file_path']
        full_file_path = os.path.join(TEST_CASES_DIR, file_path)
        
        with open(full_file_path, 'r', encoding='utf-8') as f:
            file_data = json.load(f)
        
        # Обновляем тест-кейс в файле
        if isinstance(file_data, list):
            for i, tc in enumerate(file_data):
                if tc.get('id') == test_case_id:
                    file_data[i] = updated_test_case
                    break
        else:
            if file_data.get('id') == test_case_id:
                file_data = updated_test_case
        
        # Сохраняем файл
        with open(full_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'test_case': updated_test_case
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def find_free_port(start_port=5001, max_port=5010):
    """Находит свободный порт начиная с start_port"""
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    return None

if __name__ == '__main__':
    # Пытаемся найти свободный порт
    port = find_free_port()
    if port is None:
        print("❌ Не удалось найти свободный порт в диапазоне 5001-5010")
        print("💡 Попробуйте закрыть другие приложения или изменить порт вручную")
        exit(1)
    
    print(f"🚀 Запуск приложения на порту {port}")
    print(f"📱 Откройте браузер: http://localhost:{port}")
    
    app.run(debug=True, host='0.0.0.0', port=port)
