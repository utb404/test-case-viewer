// Глобальные переменные
let testCases = [];
let fileStructure = {};
let currentTestCase = null;
let isEditMode = false;
let currentEditId = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    loadTestCases();
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    searchBtn.addEventListener('click', performSearch);
    
    // Очистка поиска при изменении ввода
    searchInput.addEventListener('input', function() {
        if (this.value.trim() === '') {
            renderFileTree();
        }
    });
    
    // Кнопки управления тест-кейсами
    document.getElementById('createTestCaseBtn').addEventListener('click', createTestCase);
    document.getElementById('editTestCaseBtn').addEventListener('click', editTestCase);
    document.getElementById('duplicateTestCaseBtn').addEventListener('click', duplicateTestCase);
    document.getElementById('deleteTestCaseBtn').addEventListener('click', deleteTestCase);
    document.getElementById('saveTestCaseBtn').addEventListener('click', saveTestCase);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    
    // Управление тегами
    document.getElementById('addTagBtn').addEventListener('click', addTag);
    document.getElementById('tagInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    });
    
    // Управление уровнями
    document.getElementById('addLevelBtn').addEventListener('click', addLevel);
    
    // Управление шагами
    document.getElementById('addStepBtn').addEventListener('click', addStep);
    
    // Создание директории
    document.getElementById('createDirectoryBtn').addEventListener('click', createDirectory);
    document.getElementById('confirmCreateDirectoryBtn').addEventListener('click', confirmCreateDirectory);
}

// Загрузка тест-кейсов
async function loadTestCases() {
    try {
        const response = await fetch('/api/test-cases');
        const data = await response.json();
        
        if (data.success) {
            testCases = data.test_cases;
            fileStructure = data.file_structure;
            renderFileTree();
        } else {
            showError('Ошибка загрузки тест-кейсов: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
}

// Отображение дерева файлов
function renderFileTree() {
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';
    
    if (Object.keys(fileStructure).length === 0) {
        fileTree.innerHTML = '<div class="text-muted text-center">Нет файлов для отображения</div>';
        return;
    }
    
    const treeHtml = buildTreeHtml(fileStructure);
    fileTree.innerHTML = treeHtml;
    
    // Добавляем обработчики кликов
    addTreeEventListeners();
}

// Построение HTML для дерева
function buildTreeHtml(structure, level = 0) {
    let html = '';
    
    for (const [name, item] of Object.entries(structure)) {
        if (item.type === 'folder') {
            html += `
                <div class="tree-item folder" data-type="folder" data-name="${name}">
                    <span class="tree-toggle">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                    <i class="fas fa-folder tree-icon"></i>
                    ${name}
                </div>
                <div class="tree-children" style="display: none;">
                    ${buildTreeHtml(item.children, level + 1)}
                </div>
            `;
        } else if (item.type === 'file') {
            const testCaseCount = item.test_cases.length;
            html += `
                <div class="tree-item file" data-type="file" data-path="${item.path}">
                    <i class="fas fa-file-code tree-icon"></i>
                    ${name}
                    <span class="badge bg-secondary ms-2">${testCaseCount}</span>
                </div>
            `;
        }
    }
    
    return html;
}

// Добавление обработчиков событий для дерева
function addTreeEventListeners() {
    // Обработчики для папок
    document.querySelectorAll('.tree-item.folder').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleFolder(this);
        });
    });
    
    // Обработчики для файлов
    document.querySelectorAll('.tree-item.file').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const filePath = this.dataset.path;
            loadFileTestCases(filePath);
        });
    });
}

// Переключение папки
function toggleFolder(folderElement) {
    const children = folderElement.nextElementSibling;
    const toggle = folderElement.querySelector('.tree-toggle i');
    
    if (children.style.display === 'none') {
        children.style.display = 'block';
        toggle.classList.remove('fa-chevron-right');
        toggle.classList.add('fa-chevron-down');
    } else {
        children.style.display = 'none';
        toggle.classList.remove('fa-chevron-down');
        toggle.classList.add('fa-chevron-right');
    }
}

// Загрузка тест-кейсов из файла
function loadFileTestCases(filePath) {
    const fileTestCases = testCases.filter(tc => tc.file_path === filePath);
    
    if (fileTestCases.length === 0) {
        showError('В файле не найдено тест-кейсов');
        return;
    }
    
    // Если в файле только один тест-кейс, показываем его сразу
    if (fileTestCases.length === 1) {
        displayTestCase(fileTestCases[0].test_case);
    } else {
        // Если несколько, показываем список
        showTestCaseList(fileTestCases, filePath);
    }
    
    // Обновляем активный элемент
    updateActiveFile(filePath);
}

// Показ списка тест-кейсов из файла
function showTestCaseList(fileTestCases, filePath) {
    const content = document.getElementById('testCaseContent');
    const title = document.getElementById('testCaseTitle');
    
    title.textContent = `Тест-кейсы из файла: ${filePath}`;
    
    let html = '<div class="row">';
    fileTestCases.forEach((item, index) => {
        const tc = item.test_case;
        html += `
            <div class="col-md-6 mb-3">
                <div class="card h-100 test-case-preview" data-test-case-id="${tc.id}">
                    <div class="card-body">
                        <h6 class="card-title">${tc.title}</h6>
                        <p class="card-text">
                            <small class="text-muted">ID: ${tc.id}</small><br>
                            <small class="text-muted">Автор: ${tc.author}</small><br>
                            <small class="text-muted">Статус: ${tc.status}</small>
                        </p>
                        <div class="tags">
                            ${tc.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    content.innerHTML = html;
    
    // Добавляем обработчики кликов
    document.querySelectorAll('.test-case-preview').forEach(card => {
        card.addEventListener('click', function() {
            const testCaseId = this.dataset.testCaseId;
            const testCase = fileTestCases.find(tc => tc.test_case.id === testCaseId);
            if (testCase) {
                displayTestCase(testCase.test_case);
            }
        });
    });
}

// Отображение деталей тест-кейса
function displayTestCase(testCase) {
    currentTestCase = testCase;
    const title = document.getElementById('testCaseTitle');
    const content = document.getElementById('testCaseContent');
    
    title.textContent = testCase.title;
    
    const html = `
        <div class="test-case-card fade-in">
            <div class="test-case-header">
                <h3 class="test-case-title">${testCase.title}</h3>
                <div class="test-case-meta">
                    <div class="meta-item">
                        <span class="meta-label">ID:</span>
                        <span class="meta-value">${testCase.id}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Автор:</span>
                        <span class="meta-value">${testCase.author}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Статус:</span>
                        <span class="meta-value">${testCase.status}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Use Case ID:</span>
                        <span class="meta-value">${testCase.useCaseId}</span>
                    </div>
                </div>
            </div>
            
            <div class="test-case-body">
                ${testCase.tags && testCase.tags.length > 0 ? `
                    <div class="tags">
                        <strong>Теги:</strong>
                        ${testCase.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.levels && testCase.levels.length > 0 ? `
                    <div class="levels">
                        <strong>Уровни тестирования:</strong>
                        ${testCase.levels.map(level => `<span class="level">${level}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.precondition ? `
                    <div class="precondition">
                        <h6><i class="fas fa-exclamation-triangle"></i> Предусловие</h6>
                        <p>${testCase.precondition}</p>
                    </div>
                ` : ''}
                
                ${testCase.actions && testCase.actions.length > 0 ? `
                    <div class="test-steps">
                        <h5><i class="fas fa-list-ol"></i> Шаги выполнения</h5>
                        ${testCase.actions.map((action, index) => `
                            <div class="test-step">
                                <div class="step-header">
                                    <div class="step-number">${index + 1}</div>
                                    <div class="step-action">${action.step}</div>
                                </div>
                                <div class="step-content">
                                    <div class="step-expected">
                                        <strong>Ожидаемый результат:</strong> ${action.expected_res}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// Обновление активного файла в дереве
function updateActiveFile(filePath) {
    // Убираем активный класс со всех элементов
    document.querySelectorAll('.tree-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Добавляем активный класс к выбранному файлу
    const activeFile = document.querySelector(`[data-path="${filePath}"]`);
    if (activeFile) {
        activeFile.classList.add('active');
    }
}

// Поиск тест-кейсов
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (query === '') {
        renderFileTree();
        return;
    }
    
    try {
        const response = await fetch(`/api/test-cases/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            showSearchResults(data.results, query);
        } else {
            showError('Ошибка поиска: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети при поиске: ' + error.message);
    }
}

// Показ результатов поиска
function showSearchResults(results, query) {
    const content = document.getElementById('testCaseContent');
    const title = document.getElementById('testCaseTitle');
    
    title.textContent = `Результаты поиска: "${query}" (${results.length} найдено)`;
    
    if (results.length === 0) {
        content.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-search fa-3x mb-3"></i>
                <p>По запросу "${query}" ничего не найдено</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="row">';
    results.forEach(item => {
        const tc = item.test_case;
        html += `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100 test-case-preview" data-test-case-id="${tc.id}">
                    <div class="card-body">
                        <h6 class="card-title">${highlightSearchTerm(tc.title, query)}</h6>
                        <p class="card-text">
                            <small class="text-muted">ID: ${highlightSearchTerm(tc.id, query)}</small><br>
                            <small class="text-muted">Автор: ${tc.author}</small><br>
                            <small class="text-muted">Файл: ${item.file_path}</small>
                        </p>
                        <div class="tags">
                            ${tc.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    content.innerHTML = html;
    
    // Добавляем обработчики кликов
    document.querySelectorAll('.test-case-preview').forEach(card => {
        card.addEventListener('click', function() {
            const testCaseId = this.dataset.testCaseId;
            const testCase = results.find(tc => tc.test_case.id === testCaseId);
            if (testCase) {
                displayTestCase(testCase.test_case);
            }
        });
    });
}

// Подсветка найденного текста
function highlightSearchTerm(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Показ ошибки
function showError(message) {
    const content = document.getElementById('testCaseContent');
    content.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
}

// CRUD функции для тест-кейсов

// Создание нового тест-кейса
function createTestCase() {
    isEditMode = false;
    currentEditId = null;
    
    // Очищаем форму
    clearForm();
    
    // Показываем модальное окно
    document.getElementById('testCaseModalTitle').textContent = 'Создать тест-кейс';
    const modal = new bootstrap.Modal(document.getElementById('testCaseModal'));
    modal.show();
}

// Редактирование тест-кейса
function editTestCase() {
    if (!currentTestCase) return;
    
    isEditMode = true;
    currentEditId = currentTestCase.id;
    
    // Заполняем форму данными
    fillForm(currentTestCase);
    
    // Показываем модальное окно
    document.getElementById('testCaseModalTitle').textContent = 'Редактировать тест-кейс';
    const modal = new bootstrap.Modal(document.getElementById('testCaseModal'));
    modal.show();
}

// Дублирование тест-кейса
async function duplicateTestCase() {
    if (!currentTestCase) return;
    
    try {
        const response = await fetch(`/api/test-case/${currentTestCase.id}/duplicate`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Тест-кейс успешно дублирован');
            loadTestCases(); // Перезагружаем данные
            displayTestCase(data.test_case); // Показываем новый тест-кейс
        } else {
            showError('Ошибка дублирования: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
}

// Удаление тест-кейса
function deleteTestCase() {
    if (!currentTestCase) return;
    
    // Показываем диалог подтверждения
    document.getElementById('deleteTestCaseName').textContent = currentTestCase.title;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

// Подтверждение удаления
async function confirmDelete() {
    if (!currentTestCase) return;
    
    try {
        const response = await fetch(`/api/test-case/${currentTestCase.id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Тест-кейс успешно удален');
            loadTestCases(); // Перезагружаем данные
            
            // Очищаем правую панель
            document.getElementById('testCaseContent').innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-file-alt fa-3x mb-3"></i>
                    <p>Выберите тест-кейс из левой панели для просмотра его деталей</p>
                </div>
            `;
            document.getElementById('testCaseTitle').textContent = 'Выберите тест-кейс для просмотра';
            document.getElementById('testCaseActions').style.display = 'none';
            currentTestCase = null;
        } else {
            showError('Ошибка удаления: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
    
    // Закрываем модальное окно
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
    modal.hide();
}

// Сохранение тест-кейса
async function saveTestCase() {
    const formData = getFormData();
    
    if (!formData.title || !formData.author) {
        showError('Поля "Название" и "Автор" обязательны для заполнения');
        return;
    }
    
    try {
        let response;
        if (isEditMode) {
            // Обновление существующего тест-кейса
            response = await fetch(`/api/test-case/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Создание нового тест-кейса
            response = await fetch('/api/test-case', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(isEditMode ? 'Тест-кейс успешно обновлен' : 'Тест-кейс успешно создан');
            loadTestCases(); // Перезагружаем данные
            displayTestCase(data.test_case); // Показываем обновленный/новый тест-кейс
            
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('testCaseModal'));
            modal.hide();
        } else {
            showError('Ошибка сохранения: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
}

// Получение данных из формы
function getFormData() {
    const steps = [];
    document.querySelectorAll('.test-step-form').forEach(stepForm => {
        const action = stepForm.querySelector('.step-action').value.trim();
        const expected = stepForm.querySelector('.step-expected').value.trim();
        if (action && expected) {
            steps.push({
                step: action,
                expected_res: expected
            });
        }
    });
    
    return {
        id: document.getElementById('testCaseId').value.trim() || undefined,
        title: document.getElementById('testCaseTitle').value.trim(),
        author: document.getElementById('testCaseAuthor').value.trim(),
        status: document.getElementById('testCaseStatus').value,
        useCaseId: document.getElementById('testCaseUseCaseId').value.trim(),
        precondition: document.getElementById('testCasePrecondition').value.trim(),
        tags: Array.from(document.querySelectorAll('#tagsContainer .tag')).map(tag => tag.textContent),
        levels: Array.from(document.querySelectorAll('#levelsContainer .level')).map(level => level.textContent),
        actions: steps
    };
}

// Заполнение формы данными
function fillForm(testCase) {
    document.getElementById('testCaseId').value = testCase.id || '';
    document.getElementById('testCaseTitle').value = testCase.title || '';
    document.getElementById('testCaseAuthor').value = testCase.author || '';
    document.getElementById('testCaseStatus').value = testCase.status || 'Draft';
    document.getElementById('testCaseUseCaseId').value = testCase.useCaseId || '';
    document.getElementById('testCasePrecondition').value = testCase.precondition || '';
    
    // Заполняем теги
    const tagsContainer = document.getElementById('tagsContainer');
    tagsContainer.innerHTML = '';
    if (testCase.tags) {
        testCase.tags.forEach(tag => {
            addTagElement(tag);
        });
    }
    
    // Заполняем уровни
    const levelsContainer = document.getElementById('levelsContainer');
    levelsContainer.innerHTML = '';
    if (testCase.levels) {
        testCase.levels.forEach(level => {
            addLevelElement(level);
        });
    }
    
    // Заполняем шаги
    const stepsContainer = document.getElementById('testStepsContainer');
    stepsContainer.innerHTML = '';
    if (testCase.actions && testCase.actions.length > 0) {
        testCase.actions.forEach((action, index) => {
            addStepElement(action.step, action.expected_res, index === 0);
        });
    } else {
        addStepElement('', '', true);
    }
}

// Очистка формы
function clearForm() {
    document.getElementById('testCaseForm').reset();
    document.getElementById('tagsContainer').innerHTML = '';
    document.getElementById('levelsContainer').innerHTML = '';
    document.getElementById('testStepsContainer').innerHTML = '';
    addStepElement('', '', true);
}

// Управление тегами
function addTag() {
    const input = document.getElementById('tagInput');
    const tag = input.value.trim();
    if (tag) {
        addTagElement(tag);
        input.value = '';
    }
}

function addTagElement(tag) {
    const container = document.getElementById('tagsContainer');
    const tagElement = document.createElement('span');
    tagElement.className = 'tag me-2 mb-2';
    tagElement.innerHTML = `
        ${tag}
        <button type="button" class="btn-close btn-close-sm ms-1" onclick="removeTag(this)"></button>
    `;
    container.appendChild(tagElement);
}

function removeTag(button) {
    button.parentElement.remove();
}

// Управление уровнями
function addLevel() {
    const select = document.getElementById('levelSelect');
    const level = select.value;
    if (level) {
        addLevelElement(level);
    }
}

function addLevelElement(level) {
    const container = document.getElementById('levelsContainer');
    const levelElement = document.createElement('span');
    levelElement.className = 'level me-2 mb-2';
    levelElement.innerHTML = `
        ${level}
        <button type="button" class="btn-close btn-close-sm ms-1" onclick="removeLevel(this)"></button>
    `;
    container.appendChild(levelElement);
}

function removeLevel(button) {
    button.parentElement.remove();
}

// Управление шагами
function addStep() {
    addStepElement('', '', false);
}

function addStepElement(action, expected, isFirst) {
    const container = document.getElementById('testStepsContainer');
    const stepElement = document.createElement('div');
    stepElement.className = 'test-step-form mb-3';
    stepElement.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <label class="form-label">Шаг</label>
                <textarea class="form-control step-action" rows="2" placeholder="Опишите действие">${action}</textarea>
            </div>
            <div class="col-md-6">
                <label class="form-label">Ожидаемый результат</label>
                <textarea class="form-control step-expected" rows="2" placeholder="Опишите ожидаемый результат">${expected}</textarea>
            </div>
        </div>
        <button type="button" class="btn btn-outline-danger btn-sm mt-2 remove-step" ${isFirst ? 'style="display: none;"' : ''}>
            <i class="fas fa-trash"></i> Удалить шаг
        </button>
    `;
    
    // Добавляем обработчик удаления шага
    const removeBtn = stepElement.querySelector('.remove-step');
    removeBtn.addEventListener('click', function() {
        stepElement.remove();
        updateRemoveButtons();
    });
    
    container.appendChild(stepElement);
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const steps = document.querySelectorAll('.test-step-form');
    steps.forEach((step, index) => {
        const removeBtn = step.querySelector('.remove-step');
        if (steps.length === 1) {
            removeBtn.style.display = 'none';
        } else {
            removeBtn.style.display = 'inline-block';
        }
    });
}

// Показ успешного сообщения
function showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alert.innerHTML = `
        <i class="fas fa-check-circle"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

// Обновление отображения кнопок управления
function updateTestCaseActions() {
    const actionsDiv = document.getElementById('testCaseActions');
    if (currentTestCase) {
        actionsDiv.style.display = 'block';
    } else {
        actionsDiv.style.display = 'none';
    }
}

// Обновляем отображение кнопок при отображении тест-кейса
function displayTestCase(testCase) {
    currentTestCase = testCase;
    updateTestCaseActions();
    
    // ... остальной код функции displayTestCase остается без изменений
    const title = document.getElementById('testCaseTitle');
    const content = document.getElementById('testCaseContent');
    
    title.textContent = testCase.title;
    
    const html = `
        <div class="test-case-card fade-in">
            <div class="test-case-header">
                <h3 class="test-case-title">${testCase.title}</h3>
                <div class="test-case-meta">
                    <div class="meta-item">
                        <span class="meta-label">ID:</span>
                        <span class="meta-value">${testCase.id}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Автор:</span>
                        <span class="meta-value">${testCase.author}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Статус:</span>
                        <span class="meta-value">${testCase.status}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Use Case ID:</span>
                        <span class="meta-value">${testCase.useCaseId}</span>
                    </div>
                </div>
            </div>
            
            <div class="test-case-body">
                ${testCase.tags && testCase.tags.length > 0 ? `
                    <div class="tags">
                        <strong>Теги:</strong>
                        ${testCase.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.levels && testCase.levels.length > 0 ? `
                    <div class="levels">
                        <strong>Уровни тестирования:</strong>
                        ${testCase.levels.map(level => `<span class="level">${level}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.precondition ? `
                    <div class="precondition">
                        <h6><i class="fas fa-exclamation-triangle"></i> Предусловие</h6>
                        <p>${testCase.precondition}</p>
                    </div>
                ` : ''}
                
                ${testCase.actions && testCase.actions.length > 0 ? `
                    <div class="test-steps">
                        <h5><i class="fas fa-list-ol"></i> Шаги выполнения</h5>
                        ${testCase.actions.map((action, index) => `
                            <div class="test-step">
                                <div class="step-header">
                                    <div class="step-number">${index + 1}</div>
                                    <div class="step-action">${action.step}</div>
                                </div>
                                <div class="step-content">
                                    <div class="step-expected">
                                        <strong>Ожидаемый результат:</strong> ${action.expected_res}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// Функции для работы с директориями

// Создание директории
function createDirectory() {
    document.getElementById('directoryName').value = '';
    const modal = new bootstrap.Modal(document.getElementById('createDirectoryModal'));
    modal.show();
}

// Подтверждение создания директории
async function confirmCreateDirectory() {
    const directoryName = document.getElementById('directoryName').value.trim();
    
    if (!directoryName) {
        showError('Название директории обязательно');
        return;
    }
    
    try {
        const response = await fetch('/api/directories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: directoryName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Директория успешно создана');
            loadTestCases(); // Перезагружаем данные
            
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('createDirectoryModal'));
            modal.hide();
        } else {
            showError('Ошибка создания директории: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
}

// Инициализация drag-and-drop для файлов
function initializeFileDragAndDrop() {
    // Создаем Sortable для файлов
    const fileTree = document.getElementById('fileTree');
    if (fileTree) {
        new Sortable(fileTree, {
            group: 'files',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function(evt) {
                handleFileMove(evt);
            }
        });
    }
}

// Обработка перемещения файлов
async function handleFileMove(evt) {
    const draggedElement = evt.item;
    const testCaseId = draggedElement.dataset.testCaseId;
    
    if (!testCaseId) return; // Если это не тест-кейс
    
    // Определяем новую директорию/файл
    const newParent = evt.to.closest('.tree-children') || evt.to;
    const newPath = determineNewPath(newParent);
    
    if (!newPath) {
        showError('Не удалось определить новое расположение');
        return;
    }
    
    try {
        const response = await fetch(`/api/test-case/${testCaseId}/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file_path: newPath })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Тест-кейс перемещен');
            loadTestCases(); // Перезагружаем данные
        } else {
            showError('Ошибка перемещения: ' + data.error);
            // Возвращаем элемент на место
            evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex]);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
        // Возвращаем элемент на место
        evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex]);
    }
}

// Определение нового пути для файла
function determineNewPath(parentElement) {
    // Логика определения нового пути на основе структуры дерева
    // Это упрощенная версия - в реальном приложении нужно более сложная логика
    const pathParts = [];
    let current = parentElement;
    
    while (current && current !== document.getElementById('fileTree')) {
        if (current.classList.contains('tree-item') && current.dataset.name) {
            pathParts.unshift(current.dataset.name);
        }
        current = current.parentElement;
    }
    
    if (pathParts.length === 0) return null;
    
    // Если это директория, создаем файл по умолчанию
    if (pathParts.length > 0 && !pathParts[pathParts.length - 1].endsWith('.json')) {
        pathParts.push('test_cases.json');
    }
    
    return pathParts.join('/');
}

// Инициализация drag-and-drop для шагов
function initializeStepDragAndDrop() {
    const stepsContainer = document.getElementById('sortable-steps');
    if (stepsContainer) {
        new Sortable(stepsContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            onEnd: function(evt) {
                handleStepReorder(evt);
            }
        });
    }
}

// Обработка изменения порядка шагов
async function handleStepReorder(evt) {
    if (!currentTestCase) return;
    
    const steps = [];
    const stepElements = document.querySelectorAll('#sortable-steps .sortable-step');
    
    stepElements.forEach(stepElement => {
        const actionElement = stepElement.querySelector('.step-action');
        const expectedElement = stepElement.querySelector('.step-expected');
        
        if (actionElement && expectedElement) {
            const action = actionElement.textContent.trim();
            const expected = expectedElement.textContent.replace('Ожидаемый результат:', '').trim();
            
            if (action && expected) {
                steps.push({
                    step: action,
                    expected_res: expected
                });
            }
        }
    });
    
    try {
        const response = await fetch(`/api/test-case/${currentTestCase.id}/reorder-steps`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ steps: steps })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Порядок шагов обновлен');
            // Обновляем отображение тест-кейса
            displayTestCase(data.test_case);
        } else {
            showError('Ошибка обновления порядка шагов: ' + data.error);
        }
    } catch (error) {
        showError('Ошибка сети: ' + error.message);
    }
}

// Обновляем функцию отображения тест-кейса для поддержки drag-and-drop
function displayTestCase(testCase) {
    currentTestCase = testCase;
    updateTestCaseActions();
    
    const title = document.getElementById('testCaseTitle');
    const content = document.getElementById('testCaseContent');
    
    title.textContent = testCase.title;
    
    const html = `
        <div class="test-case-card fade-in">
            <div class="test-case-header">
                <h3 class="test-case-title">${testCase.title}</h3>
                <div class="test-case-meta">
                    <div class="meta-item">
                        <span class="meta-label">ID:</span>
                        <span class="meta-value">${testCase.id}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Автор:</span>
                        <span class="meta-value">${testCase.author}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Статус:</span>
                        <span class="meta-value">${testCase.status}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Use Case ID:</span>
                        <span class="meta-value">${testCase.useCaseId}</span>
                    </div>
                </div>
            </div>
            
            <div class="test-case-body">
                ${testCase.tags && testCase.tags.length > 0 ? `
                    <div class="tags">
                        <strong>Теги:</strong>
                        ${testCase.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.levels && testCase.levels.length > 0 ? `
                    <div class="levels">
                        <strong>Уровни тестирования:</strong>
                        ${testCase.levels.map(level => `<span class="level">${level}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${testCase.precondition ? `
                    <div class="precondition">
                        <h6><i class="fas fa-exclamation-triangle"></i> Предусловие</h6>
                        <p>${testCase.precondition}</p>
                    </div>
                ` : ''}
                
                ${testCase.actions && testCase.actions.length > 0 ? `
                    <div class="test-steps">
                        <h5><i class="fas fa-list-ol"></i> Шаги выполнения <small class="text-muted">(перетащите для изменения порядка)</small></h5>
                        <div id="sortable-steps">
                            ${testCase.actions.map((action, index) => `
                                <div class="test-step sortable-step" data-step-index="${index}">
                                    <div class="step-header">
                                        <div class="step-number">${index + 1}</div>
                                        <div class="step-action">${action.step}</div>
                                        <div class="drag-handle">
                                            <i class="fas fa-grip-vertical"></i>
                                        </div>
                                    </div>
                                    <div class="step-content">
                                        <div class="step-expected">
                                            <strong>Ожидаемый результат:</strong> ${action.expected_res}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    
    // Инициализируем drag-and-drop для шагов
    setTimeout(() => {
        initializeStepDragAndDrop();
    }, 100);
}

// Обновляем функцию отображения дерева файлов для поддержки drag-and-drop
function renderFileTree() {
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';
    
    if (Object.keys(fileStructure).length === 0) {
        fileTree.innerHTML = '<div class="text-muted text-center">Нет файлов для отображения</div>';
        return;
    }
    
    const treeHtml = buildTreeHtml(fileStructure);
    fileTree.innerHTML = treeHtml;
    
    // Добавляем обработчики кликов
    addTreeEventListeners();
    
    // Инициализируем drag-and-drop
    setTimeout(() => {
        initializeFileDragAndDrop();
    }, 100);
}

// Экспорт функций для глобального доступа
window.loadTestCases = loadTestCases;
window.displayTestCase = displayTestCase;
window.removeTag = removeTag;
window.removeLevel = removeLevel;
