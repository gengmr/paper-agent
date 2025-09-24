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
    }

    // 通用滑块值显示逻辑
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueSpan = document.getElementById(slider.id.replace('slider', 'value'));
        if (valueSpan) {
            slider.addEventListener('input', () => {
                valueSpan.textContent = slider.value;
            });
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


// --- 单篇文献分析页 ---
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

// --- 综合文献分析页 ---
function initComprehensiveAnalysisPage() {
    const paperListContainer = document.getElementById('analyzed-paper-list');
    const startBtn = document.getElementById('start-comprehensive-analysis-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const reportOutput = document.getElementById('report-output');

    // 新增：页面加载时获取并显示已有的综合报告
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
    fetchExistingReport(); // 调用新函数
}

// --- 头脑风暴页 ---
function initBrainstormingPage() {
    const startBtn = document.getElementById('start-brainstorming-btn');
    const outputDiv = document.getElementById('brainstorming-output');

    startBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        startBtn.disabled = true;
        startBtn.textContent = '思考中...';
        outputDiv.innerHTML = '<p>正在激发灵感，请稍候...</p>';

        const model = document.getElementById('model-select').value;
        const temperature = document.getElementById('temp-slider').value;

        try {
            const response = await fetch('/api/brainstorming/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model, temperature })
            });
            const result = await response.json();
            if (response.ok) {
                outputDiv.innerHTML = marked.parse(result.results);
            } else {
                outputDiv.innerHTML = `<p style="color: var(--error-color);">头脑风暴失败: ${result.message}</p>`;
            }
        } catch (error) {
            outputDiv.innerHTML = `<p style="color: var(--error-color);">发生网络错误: ${error}</p>`;
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = '开始头脑风暴';
        }
    });
}