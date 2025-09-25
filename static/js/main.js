// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/') {
        initIndexPage();
    } else if (path.includes('single_literature_analysis')) {
        initSingleAnalysisPage();
    } else if (path.includes('comprehensive_literature_analysis')) {
        initComprehensiveAnalysisPage();
    } else if (path.includes('brainstorming')) {
        initBrainstormingPage();
    } else if (path.includes('paper_writing')) {
        initPaperWritingPage();
    }

    // 通用滑块值显示逻辑
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueSpanId = slider.id.replace('slider', 'value');
        const valueSpan = document.getElementById(valueSpanId);
        if (valueSpan) {
            const updateValue = () => { valueSpan.textContent = slider.value; };
            slider.addEventListener('input', updateValue);
            updateValue();
        }
    });
});

// --- 辅助函数：获取API Key ---
function getApiKey() {
    const apiKey = localStorage.getItem('googleApiKey');
    if (!apiKey) {
        alert('错误：API Key未设置。请返回首页进行设置。');
        return null;
    }
    return apiKey;
}

// --- 首页：API Key配置 ---
function initIndexPage() {
    const apiKeyInput = document.getElementById('api-key-input');
    const saveBtn = document.getElementById('save-api-key-btn');
    const statusEl = document.getElementById('api-key-status');

    const savedKey = localStorage.getItem('googleApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        statusEl.textContent = '已加载保存的API Key。';
        statusEl.className = 'status-message success';
    }

    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('googleApiKey', key);
            statusEl.textContent = 'API Key 已成功保存到浏览器！';
            statusEl.className = 'status-message success';
        } else {
            statusEl.textContent = '请输入有效的API Key。';
            statusEl.className = 'status-message error';
        }
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
}

// --- 单篇文献分析页 (完整代码，无变化) ---
function initSingleAnalysisPage() {
    const paperListContainer = document.getElementById('paper-list-container');
    const startBtn = document.getElementById('start-single-analysis-btn');
    const progressLog = document.getElementById('progress-log');

    async function fetchPapers() {
        try {
            const response = await fetch('/api/papers');
            const papers = await response.json();
            renderPaperList(papers);
        } catch (error) {
            paperListContainer.innerHTML = `<p style="color: var(--error-color);">加载文件列表失败: ${error}</p>`;
        }
    }

    function renderPaperList(papers) {
        if (papers.length === 0) {
            paperListContainer.innerHTML = '<p>未在 `papers` 目录中找到任何PDF文件。</p>';
            return;
        }
        const ul = document.createElement('ul');
        papers.forEach(paper => {
            const li = document.createElement('li');
            li.dataset.filename = paper.filename;
            const statusClass = paper.processed ? 'status-processed' : 'status-pending';
            const statusText = paper.processed ? '已处理' : '待处理';
            li.innerHTML = `
                <span><i class="fas fa-file-pdf"></i> ${paper.filename}</span>
                <span class="status-indicator ${statusClass}">${statusText}</span>
            `;
            ul.appendChild(li);
        });
        paperListContainer.innerHTML = '';
        paperListContainer.appendChild(ul);
    }

    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (type === 'error') p.style.color = 'var(--error-color)';
        else if (type === 'success') p.style.color = 'var(--success-color)';
        else p.style.color = '#343a40';
        progressLog.appendChild(p);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    function updateFileStatus(filename, status, message) {
        const li = document.querySelector(`li[data-filename="${filename}"]`);
        if (!li) return;
        const indicator = li.querySelector('.status-indicator');
        indicator.className = `status-indicator status-${status}`;
        indicator.textContent = message;
    }

    startBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        startBtn.disabled = true;
        startBtn.textContent = '正在处理...';
        progressLog.innerHTML = '';
        logMessage('开始分析流程...');

        const model = document.getElementById('model-select').value;
        const tempMarkdown = document.getElementById('temp-markdown-slider').value;
        const tempAnalysis = document.getElementById('temp-analysis-slider').value;

        const papersToProcess = Array.from(document.querySelectorAll('.status-pending'))
            .map(el => el.closest('li').dataset.filename);

        if (papersToProcess.length === 0) {
            logMessage('没有需要处理的文件。', 'info');
            startBtn.disabled = false;
            startBtn.textContent = '开始分析';
            return;
        }

        for (const filename of papersToProcess) {
            logMessage(`开始处理文件: ${filename}...`);
            updateFileStatus(filename, 'processing', '正在处理...');

            try {
                const response = await fetch('/api/single_analysis/process_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        filename,
                        model,
                        temperature_markdown: tempMarkdown,
                        temperature_analysis: tempAnalysis
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    logMessage(`文件 ${filename} 处理成功。`, 'success');
                    updateFileStatus(filename, 'processed', '已处理');
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                logMessage(`文件 ${filename} 处理失败: ${error.message}`, 'error');
                updateFileStatus(filename, 'failed', '处理失败');
            }
        }

        logMessage('所有任务已完成。', 'info');
        startBtn.disabled = false;
        startBtn.textContent = '开始分析';
    });

    fetchPapers();
}

// --- 综合文献分析页 (完整代码，无变化) ---
function initComprehensiveAnalysisPage() {
    const paperListContainer = document.getElementById('analyzed-paper-list');
    const startBtn = document.getElementById('start-comprehensive-analysis-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const reportOutput = document.getElementById('report-output');

    async function fetchExistingReport() {
        try {
            const response = await fetch('/api/comprehensive_report');
            const data = await response.json();
            if (data.content) {
                reportOutput.innerHTML = marked.parse(data.content);
            } else {
                reportOutput.innerHTML = '<p>尚未生成综合分析报告。请选择文献后点击上方按钮生成。</p>';
            }
        } catch (error) {
            reportOutput.innerHTML = `<p style="color: var(--error-color);">加载报告失败: ${error}</p>`;
        }
    }

    async function fetchAnalyzedPapers() {
        try {
            const response = await fetch('/api/analyzed_papers');
            const papers = await response.json();
            renderAnalyzedPaperList(papers);
        } catch (error) {
            paperListContainer.innerHTML = `<p style="color: var(--error-color);">加载已分析文献列表失败: ${error}</p>`;
        }
    }

    function renderAnalyzedPaperList(papers) {
        if (papers.length === 0) {
            paperListContainer.innerHTML = '<p>没有找到已分析的文献。请先完成“单篇文献分析”。</p>';
            return;
        }
        const ul = document.createElement('ul');
        papers.forEach(paper => {
            const li = document.createElement('li');
            li.innerHTML = `
                <label style="width: 100%; cursor: pointer; display: flex; align-items: center;">
                    <input type="checkbox" class="paper-checkbox" value="${paper}" style="margin-right: 10px; width: 1.2em; height: 1.2em;">
                    ${paper}.md
                </label>
            `;
            ul.appendChild(li);
        });
        paperListContainer.innerHTML = '';
        paperListContainer.appendChild(ul);
    }

    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = true);
    });

    deselectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = false);
    });

    startBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        const selectedPapers = Array.from(document.querySelectorAll('.paper-checkbox:checked')).map(cb => cb.value);
        if (selectedPapers.length === 0) {
            alert('请至少选择一篇文献！');
            return;
        }

        startBtn.disabled = true;
        startBtn.textContent = '正在生成...';
        reportOutput.innerHTML = '<p>正在生成报告，请稍候...</p>';

        const model = document.getElementById('model-select').value;
        const temperature = document.getElementById('temp-slider').value;

        try {
            const response = await fetch('/api/comprehensive_analysis/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model, temperature, papers: selectedPapers })
            });
            const result = await response.json();
            if (response.ok) {
                reportOutput.innerHTML = marked.parse(result.report);
            } else {
                reportOutput.innerHTML = `<p style="color: var(--error-color);">生成失败: ${result.message}</p>`;
            }
        } catch (error) {
            reportOutput.innerHTML = `<p style="color: var(--error-color);">发生网络错误: ${error}</p>`;
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = '生成/更新综述报告';
        }
    });

    fetchAnalyzedPapers();
    fetchExistingReport();
}


// --- 头脑风暴页 (完整代码，无变化) ---
function initBrainstormingPage() {
    let history = [];
    let historyIndex = -1;

    const startBtn = document.getElementById('start-brainstorming-btn');
    const outputDiv = document.getElementById('brainstorming-output');
    const modificationBar = document.getElementById('modification-bar');
    const modificationPrompt = document.getElementById('modification-prompt');
    const historyControls = document.getElementById('history-controls');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const analysisBasisP = document.getElementById('analysis-basis');

    modificationBar.appendChild(startBtn);

    function updateHistoryButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function updateUI(content) {
        const controlsCard = document.querySelector('.controls-card');

        if (content) {
            outputDiv.innerHTML = marked.parse(content);
            modificationBar.style.display = 'flex';
            historyControls.style.display = 'flex';
            analysisBasisP.style.display = 'none';
            startBtn.textContent = '修改头脑风暴';
        } else {
            outputDiv.innerHTML = '<p>点击下方按钮开始...</p>';
            modificationBar.style.display = 'none';
            historyControls.style.display = 'none';
            analysisBasisP.style.display = 'block';
            controlsCard.appendChild(startBtn);
            startBtn.textContent = '开始头脑风暴';
        }
        updateHistoryButtons();
    }

    async function loadInitialResult() {
        try {
            const response = await fetch('/api/brainstorming/result');
            const data = await response.json();
            if (data.content) {
                history = [data.content];
                historyIndex = 0;
                updateUI(data.content);
            } else {
                updateUI(null);
            }
        } catch (error) {
            outputDiv.innerHTML = `<p style="color: var(--error-color);">加载历史结果失败: ${error}</p>`;
            updateUI(null);
        }
    }

    startBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        startBtn.disabled = true;
        startBtn.textContent = '思考中...';
        outputDiv.innerHTML = '<p>正在激发灵感，请稍候...</p>';

        const model = document.getElementById('model-select').value;
        const temperature = document.getElementById('temp-slider').value;

        let requestBody = { apiKey, model, temperature };
        const isModification = historyIndex > -1;

        if (isModification) {
            const promptText = modificationPrompt.value.trim();
            if (!promptText) {
                alert('请输入修改指令。');
                startBtn.disabled = false;
                startBtn.textContent = '修改头脑风暴';
                outputDiv.innerHTML = marked.parse(history[historyIndex]);
                return;
            }
            requestBody.existing_results = history[historyIndex];
            requestBody.modification_prompt = promptText;
        }

        try {
            const response = await fetch('/api/brainstorming/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const result = await response.json();
            if (response.ok) {
                history = history.slice(0, historyIndex + 1);
                history.push(result.results);
                historyIndex = history.length - 1;

                updateUI(result.results);
                modificationPrompt.value = '';
            } else {
                outputDiv.innerHTML = `<p style="color: var(--error-color);">操作失败: ${result.message}</p>`;
                if(historyIndex > -1 && history[historyIndex]) {
                   outputDiv.innerHTML = marked.parse(history[historyIndex]);
                }
            }
        } catch (error) {
            outputDiv.innerHTML = `<p style="color: var(--error-color);">发生网络错误: ${error}</p>`;
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = isModification || history.length > 0 ? '修改头脑风暴' : '开始头脑风暴';
        }
    });

    undoBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            outputDiv.innerHTML = marked.parse(history[historyIndex]);
            updateHistoryButtons();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            outputDiv.innerHTML = marked.parse(history[historyIndex]);
            updateHistoryButtons();
        }
    });

    modificationPrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            startBtn.click();
        }
    });

    loadInitialResult();
}


// --- 论文写作页 (已根据新要求重构) ---
function initPaperWritingPage() {
    const ideaContainer = document.getElementById('idea-container');
    const paperContainer = document.getElementById('paper-container');
    const promptBar = document.getElementById('prompt-bar');
    const globalPromptInput = document.getElementById('global-prompt-input');
    const submitPromptBtn = document.getElementById('submit-prompt-btn');
    const modelSelect = document.getElementById('paper-model-select');
    const languageSelect = document.getElementById('paper-language-select');
    const tempSlider = document.getElementById('paper-temp-slider');

    let paperState = {};
    let activeSectionForPrompt = null;
    let saveTimeout;
    let editingSection = null;

    const sections = {
        idea: { name: 'Idea', dependencies: [] },
        title: { name: '标题', dependencies: ['idea'] },
        abstract: { name: '摘要', dependencies: ['idea', 'title'] },
        keywords: { name: '关键词', dependencies: ['title', 'abstract'] },
        introduction: { name: '1. 引言', dependencies: ['title', 'abstract'] },
        background: { name: '2. 理论背景与假设建立', dependencies: ['title', 'abstract'] },
        methods: { name: '3. 研究方法', dependencies: ['title', 'abstract', 'background'] },
        results: { name: '4. 结果', dependencies: ['title', 'abstract', 'methods'] },
        discussion: { name: '5. 讨论', dependencies: ['title', 'abstract', 'methods', 'results'] },
        conclusion: { name: '6. 结论', dependencies: ['title', 'abstract', 'methods', 'results', 'discussion'] },
    };

    function adjustTextareaHeight(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }

    function renderMarkdown(rawText, targetElement) {
        if (!rawText && targetElement.classList.contains('content-display')) {
            targetElement.innerHTML = `<span class="empty-placeholder">点击右侧按钮生成内容...</span>`;
            return;
        }

        const renderedHtml = marked.parse(rawText);
        targetElement.innerHTML = renderedHtml;

        // Render math
        const mathElements = targetElement.querySelectorAll('.katex-math');
        mathElements.forEach(el => {
            const tex = el.textContent;
            try {
                katex.render(tex, el, {
                    throwOnError: false,
                    displayMode: el.tagName === 'DIV'
                });
            } catch (e) {
                el.textContent = tex;
                console.error("KaTeX Error: ", e);
            }
        });
    }

    function renderPaperState() {
        Object.keys(sections).forEach(key => {
            const sectionEl = document.querySelector(`.paper-section[data-key="${key}"]`);
            if (!sectionEl || !paperState[key]) return;

            const sectionConfig = sections[key];
            const sectionData = paperState[key];
            const isLocked = !sectionConfig.dependencies.every(dep => paperState[dep]?.status === 'completed');

            if (isLocked) {
                sectionData.status = 'locked';
            } else if (sectionData.status === 'locked') {
                sectionData.status = sectionData.content.trim() === '' ? 'empty' : 'completed';
            }

            sectionEl.dataset.status = sectionData.status;

            const statusCircle = sectionEl.querySelector('.status-circle');
            const depInfo = sectionEl.querySelector('.dependencies-info');
            const displayDiv = sectionEl.querySelector('.content-display');
            const textarea = sectionEl.querySelector('textarea');
            const generateBtn = sectionEl.querySelector('.btn-generate');
            const modifyBtn = sectionEl.querySelector('.btn-modify');
            const confirmIdeaBtn = sectionEl.querySelector('.btn-confirm-idea');

            if(statusCircle) {
                statusCircle.className = `status-circle ${sectionData.status}`;
                statusCircle.innerHTML = { 'locked': '<i class="fas fa-lock"></i>', 'completed': '<i class="fas fa-check"></i>', 'empty': '', 'generating': '' }[sectionData.status] || '';
            }

            if(depInfo) {
                depInfo.innerHTML = sectionConfig.dependencies.map(dep => {
                    const isCompleted = paperState[dep]?.status === 'completed';
                    const icon = isCompleted ? '<i class="fas fa-check-circle icon"></i>' : '<i class="fas fa-times-circle icon"></i>';
                    return `<span class="dep-item ${isCompleted ? 'completed' : 'pending'}">${icon} ${sections[dep].name}</span>`;
                }).join(' ') || '无依赖';
            }

            const isEditingThisSection = editingSection === key;
            if (displayDiv) {
                displayDiv.style.display = isEditingThisSection ? 'none' : 'block';
                renderMarkdown(sectionData.content, displayDiv);
            }
            if(textarea) {
                textarea.style.display = isEditingThisSection ? 'block' : 'none';
                if(isEditingThisSection) {
                    textarea.value = sectionData.content;
                    adjustTextareaHeight(textarea);
                    textarea.focus();
                }
            }

            if(generateBtn) generateBtn.style.display = (sectionData.status === 'empty' && !isEditingThisSection) ? 'inline-block' : 'none';
            if(modifyBtn) modifyBtn.style.display = (sectionData.status === 'completed' && !isEditingThisSection) ? 'inline-block' : 'none';
            if(confirmIdeaBtn) confirmIdeaBtn.style.display = (key === 'idea' && sectionData.status !== 'completed' && !isEditingThisSection) ? 'inline-block' : 'none';
        });
    }

    function createInitialStructure() {
        ideaContainer.innerHTML = '';
        paperContainer.innerHTML = '';

        for (const key in sections) {
            const sectionConfig = sections[key];
            const isIdea = key === 'idea';

            let titleHTML = `<h3 class="paper-section-title">${sectionConfig.name}</h3>`;

            const sectionHTML = `
                <div class="paper-section" data-key="${key}" id="section-${key}">
                    <div class="section-header">
                        <div class="header-left">
                           <div class="status-circle locked"><i class="fas fa-lock"></i></div>
                           <div>
                               ${titleHTML}
                               ${sectionConfig.dependencies.length > 0 ? '<div class="dependencies-info"></div>' : ''}
                           </div>
                        </div>
                        <div class="header-right section-controls">
                           ${!isIdea ? `<button class="btn btn-primary btn-generate" data-section="${key}">生成</button>` : ''}
                           ${!isIdea ? `<button class="btn btn-secondary btn-modify" data-section="${key}">修改</button>` : ''}
                           ${isIdea ? `<button class="btn btn-success btn-confirm-idea" data-section="${key}">确认想法</button>` : ''}
                        </div>
                    </div>
                    <div class="content-display" data-section="${key}"></div>
                    <textarea id="textarea-${key}" data-section="${key}" style="display: none;"></textarea>
                </div>`;

            if (isIdea) {
                ideaContainer.insertAdjacentHTML('beforeend', sectionHTML);
            } else {
                paperContainer.insertAdjacentHTML('beforeend', sectionHTML);
            }
        }
    }

    function scheduleSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                await fetch('/api/paper/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paperState),
                });
            } catch (error) { console.error('自动保存失败:', error); }
        }, 1000);
    }

    function handleInteraction(e) {
        const button = e.target.closest('button');
        if (button && button.dataset.section) {
            const sectionKey = button.dataset.section;
            if (button.classList.contains('btn-generate')) {
                handlePromptSubmit(sectionKey, false);
            } else if (button.classList.contains('btn-modify')) {
                activeSectionForPrompt = sectionKey;
                promptBar.style.display = 'flex';
                globalPromptInput.placeholder = `为"${sections[sectionKey].name}"提供修改指令...`;
                globalPromptInput.focus();
            } else if (button.classList.contains('btn-confirm-idea')) {
                const textarea = document.getElementById(`textarea-idea`);
                if (textarea.value.trim() === '') {
                    alert('Idea内容不能为空！');
                    return;
                }
                paperState.idea.status = 'completed';
                editingSection = null;
                renderPaperState();
                scheduleSave();
            }
            return;
        }

        const displayDiv = e.target.closest('.content-display');
        if (displayDiv && displayDiv.dataset.section) {
            const sectionKey = displayDiv.dataset.section;
            if (paperState[sectionKey].status !== 'locked') {
                editingSection = sectionKey;
                renderPaperState();
            }
            return;
        }

        const textarea = e.target.closest('textarea');
        if (textarea && textarea.dataset.section) {
             const sectionKey = textarea.dataset.section;
            paperState[sectionKey].content = textarea.value;
            adjustTextareaHeight(textarea);
            if (sectionKey !== 'idea' && paperState[sectionKey].status !== 'empty' && textarea.value.trim() === '') {
                 paperState[sectionKey].status = 'empty';
                 renderPaperState();
            } else if(sectionKey !== 'idea' && paperState[sectionKey].status === 'empty' && textarea.value.trim() !== ''){
                 paperState[sectionKey].status = 'completed';
                 renderPaperState();
            }
            scheduleSave();
        }
    }

    document.body.addEventListener('click', handleInteraction);
    document.body.addEventListener('input', handleInteraction);
    document.body.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'TEXTAREA' && e.target.dataset.section) {
            const sectionKey = e.target.dataset.section;
            // Idea section has a dedicated confirm button
            if (sectionKey !== 'idea') {
                editingSection = null;
                renderPaperState();
            }
        }
    });


    async function handlePromptSubmit(sectionKey, isModification, userPrompt = '') {
        const apiKey = getApiKey();
        if (!apiKey) return;
        const targetSection = sectionKey || activeSectionForPrompt;
        if (!targetSection) return;

        const originalStatus = paperState[targetSection].status;
        paperState[targetSection].status = 'generating';
        editingSection = null; // Exit editing mode
        renderPaperState();
        if(isModification) {
            promptBar.style.display = 'none';
            globalPromptInput.value = '';
        }

        try {
            const response = await fetch('/api/paper/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    model: modelSelect.value,
                    temperature: parseFloat(tempSlider.value),
                    language: languageSelect.value,
                    target_section: targetSection,
                    paper_data: paperState,
                    user_prompt: userPrompt,
                }),
            });
            const result = await response.json();
            if (response.ok) {
                paperState[targetSection].content = result.content;
                paperState[targetSection].status = 'completed';
            } else {
                alert(`生成失败: ${result.message}`);
                paperState[targetSection].status = originalStatus;
            }
        } catch (error) {
            alert(`网络错误: ${error}`);
            paperState[targetSection].status = originalStatus;
        } finally {
            activeSectionForPrompt = null;
            renderPaperState();
            scheduleSave();
        }
    }

    submitPromptBtn.addEventListener('click', () => {
        const userPrompt = globalPromptInput.value.trim();
        if (userPrompt && activeSectionForPrompt) {
            handlePromptSubmit(null, true, userPrompt);
        }
    });
    globalPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitPromptBtn.click();
        }
    });

    async function initialize() {
        createInitialStructure();
        try {
            const response = await fetch('/api/paper/content');
            paperState = await response.json();
            renderPaperState();
        } catch (error) {
            console.error('加载论文数据失败:', error);
            paperContainer.innerHTML = '<p style="color: var(--error-color);">加载数据失败，请刷新页面重试。</p>';
        }
    }

    window.addEventListener('resize', () => {
        document.querySelectorAll('.paper-section textarea').forEach(adjustTextareaHeight);
    });

    initialize();
}