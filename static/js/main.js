// static/js/main.js

/**
 * 渲染包含 Markdown、数学公式和自定义批注的文本。
 *
 * 此函数采用专业、可靠的多阶段渲染流程，以确保内容和公式的精准显示：
 * 1.  **扩展 Marked 解析**：通过一系列自定义扩展，首先识别并保护 LaTeX 公式，
 *     并对自定义的 `{{原文}}【修改意见：...】` 批注语法进行特殊处理。
 * 2.  **调用 MathJax排版**：在 Markdown 结构生成后，调用 MathJax 对页面中被保护的
 *     LaTeX 代码进行扫描和高质量的数学排版。
 *
 * @param {string} rawText - 包含 Markdown、LaTeX 和自定义批注的原始字符串。
 * @param {HTMLElement} targetElement - 用于显示渲染后内容的 DOM 元素。
 */
function renderMarkdownWithMath(rawText, targetElement) {
    if (!rawText) {
        if (targetElement.classList.contains('content-display')) {
            targetElement.innerHTML = `<span class="empty-placeholder">点击右侧按钮生成内容，或直接编辑...</span>`;
            targetElement.classList.add('is-placeholder');
        } else {
            targetElement.innerHTML = '<p>无内容可显示。</p>';
        }
        return;
    }
    targetElement.classList.remove('is-placeholder');

    const mathBlockExtension = {
        name: 'mathBlock', level: 'block', start(src) { return src.indexOf('$$'); },
        tokenizer(src, tokens) { const rule = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/; const match = rule.exec(src); if (match) return { type: 'mathBlock', raw: match[0], text: match[1].trim() }; },
        renderer(token) { return `$$${token.text}$$`; },
    };
    const mathInlineExtension = {
        name: 'mathInline', level: 'inline', start(src) { return src.indexOf('$'); },
        tokenizer(src, tokens) { const rule = /^\$((?:\\\$|[^$])+?)\$/; const match = rule.exec(src); if (match) return { type: 'mathInline', raw: match[0], text: match[1].trim() }; },
        renderer(token) { return `$${token.text}$`; },
    };
    /**
     * Marked.js 扩展，用于解析和渲染自定义的批注语法。
     * 语法: `{{被批注的文本}}【修改意见：具体的意见内容】`
     * 渲染为一个可交互的、带高亮的 <span> 元素。
     */
    const annotationExtension = {
        name: 'annotation',
        level: 'inline',
        start(src) { return src.indexOf('{{'); },
        tokenizer(src, tokens) {
            const rule = /^{{([\s\S]+?)}}【修改意见：([\s\S]+?)】/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'annotation',
                    raw: match[0],
                    annotatedText: match[1],
                    commentText: match[2],
                };
            }
        },
        renderer(token) {
            const sanitizedComment = token.commentText.replace(/"/g, '&quot;');
            const rawToken = encodeURIComponent(token.raw);
            return `<span class="annotated-text" data-comment="${sanitizedComment}" data-raw-token="${rawToken}" title="${sanitizedComment}">${token.annotatedText}</span>`;
        }
    };

    const markedInstance = new marked.Marked().use({ extensions: [mathBlockExtension, mathInlineExtension, annotationExtension] });
    const html = markedInstance.parse(rawText);
    targetElement.innerHTML = html;

    if (window.MathJax && window.MathJax.startup) {
        window.MathJax.startup.promise
            .then(() => { window.MathJax.typesetPromise([targetElement]); })
            .catch((err) => console.error("MathJax typesetting failed:", err));
    }
}


/**
 * DOM加载完成后的主入口点。
 */
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/') initIndexPage();
    else if (path.includes('single_literature_analysis')) initSingleAnalysisPage();
    else if (path.includes('comprehensive_literature_analysis')) initComprehensiveAnalysisPage();
    else if (path.includes('brainstorming')) initBrainstormingPage();
    else if (path.includes('paper_writing')) initPaperWritingPage();

    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueSpan = document.getElementById(slider.id.replace('slider', 'value'));
        if (valueSpan) {
            const updateValue = () => { valueSpan.textContent = slider.value; };
            slider.addEventListener('input', updateValue);
            updateValue();
        }
    });
});

/**
 * 从 localStorage 安全地获取 API Key。
 */
function getApiKey() {
    const apiKey = localStorage.getItem('googleApiKey');
    if (!apiKey) {
        alert('错误：API Key未设置。请返回首页进行设置。');
        return null;
    }
    return apiKey;
}

/**
 * 初始化首页逻辑。
 */
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

/**
 * 初始化单篇文献分析页逻辑。
 */
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
            li.innerHTML = `<span><i class="ph ph-file-pdf"></i> ${paper.filename}</span><span class="status-indicator ${statusClass}">${statusText}</span>`;
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
        const papersToProcess = Array.from(document.querySelectorAll('.status-pending')).map(el => el.closest('li').dataset.filename);
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
                    body: JSON.stringify({ apiKey, filename, model, temperature_markdown: tempMarkdown, temperature_analysis: tempAnalysis })
                });
                const result = await response.json();
                if (response.ok) {
                    logMessage(`文件 ${filename} 处理成功。`, 'success');
                    updateFileStatus(filename, 'processed', '已处理');
                } else { throw new Error(result.message); }
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

/**
 * 初始化综合文献分析页逻辑。
 */
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
            renderMarkdownWithMath(data.content, reportOutput);
        } catch (error) { reportOutput.innerHTML = `<p style="color: var(--error-color);">加载报告失败: ${error}</p>`; }
    }

    async function fetchAnalyzedPapers() {
        try {
            const response = await fetch('/api/analyzed_papers');
            const papers = await response.json();
            renderAnalyzedPaperList(papers);
        } catch (error) { paperListContainer.innerHTML = `<p style="color: var(--error-color);">加载已分析文献列表失败: ${error}</p>`;}
    }

    function renderAnalyzedPaperList(papers) {
        if (papers.length === 0) {
            paperListContainer.innerHTML = '<p>没有找到已分析的文献。请先完成“单篇文献分析”。</p>';
            return;
        }
        const ul = document.createElement('ul');
        papers.forEach(paper => {
            const li = document.createElement('li');
            li.innerHTML = `<label style="width: 100%; cursor: pointer; display: flex; align-items: center;"><input type="checkbox" class="paper-checkbox" value="${paper}" style="margin-right: 10px; width: 1.2em; height: 1.2em;">${paper}.md</label>`;
            ul.appendChild(li);
        });
        paperListContainer.innerHTML = '';
        paperListContainer.appendChild(ul);
    }
    selectAllBtn.addEventListener('click', () => { document.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = true); });
    deselectAllBtn.addEventListener('click', () => { document.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = false); });

    startBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;
        const selectedPapers = Array.from(document.querySelectorAll('.paper-checkbox:checked')).map(cb => cb.value);
        if (selectedPapers.length === 0) { alert('请至少选择一篇文献！'); return; }
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
                renderMarkdownWithMath(result.report, reportOutput);
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


/**
 * 初始化头脑风暴页逻辑。
 */
function initBrainstormingPage() {
    let history = [];
    let historyIndex = -1;
    const generateBtn = document.getElementById('start-brainstorming-btn');
    const outputDiv = document.getElementById('brainstorming-output');
    const modificationBar = document.getElementById('modification-bar');
    const modificationPrompt = document.getElementById('modification-prompt');
    const submitModificationBtn = document.getElementById('submit-modification-btn');
    const historyControls = document.getElementById('history-controls');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const analysisBasisP = document.getElementById('analysis-basis');

    function updateHistoryButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function updateUI(content) {
        if (content) {
            renderMarkdownWithMath(content, outputDiv);
            generateBtn.textContent = '重新生成';
            modificationBar.style.display = 'flex';
            historyControls.style.display = 'flex';
            analysisBasisP.style.display = 'none';
        } else {
            outputDiv.innerHTML = '<p>点击上方按钮开始...</p>';
            generateBtn.textContent = '开始头脑风暴';
            modificationBar.style.display = 'none';
            historyControls.style.display = 'none';
            analysisBasisP.style.display = 'block';
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
            } else { updateUI(null); }
        } catch (error) {
            outputDiv.innerHTML = `<p style="color: var(--error-color);">加载历史结果失败: ${error}</p>`;
            updateUI(null);
        }
    }

    async function performBrainstorm(isModification = false) {
        const apiKey = getApiKey();
        if (!apiKey) return;

        const actionButton = isModification ? submitModificationBtn : generateBtn;
        const originalButtonText = actionButton.textContent;
        actionButton.disabled = true;
        actionButton.textContent = '思考中...';

        if (!isModification) {
            outputDiv.innerHTML = '<p>正在激发灵感，请稍候...</p>';
        }

        const model = document.getElementById('model-select').value;
        const temperature = document.getElementById('temp-slider').value;
        let requestBody = { apiKey, model, temperature };

        if (isModification) {
            const promptText = modificationPrompt.value.trim();
            if (!promptText) {
                alert('请输入修改指令。');
                actionButton.disabled = false;
                actionButton.textContent = originalButtonText;
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
                if (historyIndex > -1 && history[historyIndex]) {
                    renderMarkdownWithMath(history[historyIndex], outputDiv);
                }
            }
        } catch (error) {
            outputDiv.innerHTML = `<p style="color: var(--error-color);">发生网络错误: ${error}</p>`;
        } finally {
            actionButton.disabled = false;
            actionButton.textContent = originalButtonText;
        }
    }

    generateBtn.addEventListener('click', () => performBrainstorm(false));
    submitModificationBtn.addEventListener('click', () => performBrainstorm(true));
    undoBtn.addEventListener('click', () => { if (historyIndex > 0) { historyIndex--; renderMarkdownWithMath(history[historyIndex], outputDiv); updateHistoryButtons(); } });
    redoBtn.addEventListener('click', () => { if (historyIndex < history.length - 1) { historyIndex++; renderMarkdownWithMath(history[historyIndex], outputDiv); updateHistoryButtons(); } });
    modificationPrompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitModificationBtn.click(); } });

    loadInitialResult();
}

// --- 论文写作页 ---

// 全局差异对比模态框逻辑
const diffModal = document.getElementById('diff-modal');
if (diffModal) {
    const closeModalBtn = document.getElementById('close-modal-btn');
    const rejectChangesBtn = document.getElementById('reject-changes-btn');
    const acceptChangesBtn = document.getElementById('accept-changes-btn');
    let onAcceptCallback = null;
    let onRejectCallback = null;

    function showDiffModal(originalText, newText, onAccept, onReject) {
        const oldPane = document.getElementById('diff-output-old');
        const newPane = document.getElementById('diff-output-new');
        oldPane.innerHTML = ''; newPane.innerHTML = '';

        const mathBlockExtension = { name: 'mathBlock', level: 'block', start(src) { return src.indexOf('$$'); }, tokenizer(src, tokens) { const rule = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/; const match = rule.exec(src); if (match) { return { type: 'mathBlock', raw: match[0], text: match[1].trim(), }; } }, renderer(token) { return `$$${token.text}$$`; }, };
        const mathInlineExtension = { name: 'mathInline', level: 'inline', start(src) { return src.indexOf('$'); }, tokenizer(src, tokens) { const rule = /^\$((?:\\\$|[^$])+?)\$/; const match = rule.exec(src); if (match) { return { type: 'mathInline', raw: match[0], text: match[1].trim(), }; } }, renderer(token) { return `$${token.text}$`; }, };
        const markedInstance = new marked.Marked().use({ extensions: [mathBlockExtension, mathInlineExtension] });

        const lineDiff = Diff.diffLines(originalText, newText);
        let oldLineNum = 1, newLineNum = 1;

        const createLine = (type, lineNumber, content) => {
            const line = document.createElement('div');
            line.className = `diff-line ${type}`;
            line.innerHTML = `<span class="line-number">${lineNumber || ''}</span><span class="line-content">${content}</span>`;
            return line;
        };

        for (let i = 0; i < lineDiff.length; i++) {
            const part = lineDiff[i];
            const lines = part.value.replace(/\n$/, '').split('\n');
            const nextPart = lineDiff[i + 1];

            if (part.removed && nextPart && nextPart.added) {
                const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const wordDiff = Diff.diffWords(part.value, nextPart.value);
                let oldContent = '', newContent = '';
                wordDiff.forEach(word => {
                    const escapedWord = escapeHtml(word.value);
                    if (word.added) newContent += `<ins>${escapedWord}</ins>`;
                    else if (word.removed) oldContent += `<del>${escapedWord}</del>`;
                    else { oldContent += escapedWord; newContent += escapedWord; }
                });
                oldPane.appendChild(createLine('removed', oldLineNum++, oldContent));
                newPane.appendChild(createLine('added', newLineNum++, newContent));
                i++;
            } else if (part.added) {
                lines.forEach(line => {
                    oldPane.appendChild(createLine('empty', null, ''));
                    newPane.appendChild(createLine('added', newLineNum++, markedInstance.parseInline(line)));
                });
            } else if (part.removed) {
                lines.forEach(line => {
                    oldPane.appendChild(createLine('removed', oldLineNum++, markedInstance.parseInline(line)));
                    newPane.appendChild(createLine('empty', null, ''));
                });
            } else {
                lines.forEach(line => {
                    const renderedLine = markedInstance.parseInline(line);
                    oldPane.appendChild(createLine('context', oldLineNum++, renderedLine));
                    newPane.appendChild(createLine('context', newLineNum++, renderedLine));
                });
            }
        }

        if (window.MathJax && window.MathJax.startup) {
            window.MathJax.startup.promise.then(() => {
                window.MathJax.typesetPromise([oldPane, newPane]);
            }).catch((err) => console.error('MathJax typesetting error in diff modal:', err));
        }

        onAcceptCallback = onAccept; onRejectCallback = onReject;
        diffModal.classList.add('visible');
        const oldPaneScroll = oldPane.parentElement, newPaneScroll = newPane.parentElement;
        let isSyncing = false;
        const onScroll = (e) => {
            if (isSyncing) return;
            isSyncing = true;
            const other = e.target === oldPaneScroll ? newPaneScroll : oldPaneScroll;
            other.scrollTop = e.target.scrollTop;
            setTimeout(() => { isSyncing = false; }, 50);
        };
        oldPaneScroll.onscroll = onScroll; newPaneScroll.onscroll = onScroll;
    }

    function hideDiffModal(isAccepting = false) {
        if (!isAccepting && onRejectCallback) {
            onRejectCallback();
        }
        diffModal.classList.remove('visible');
        onAcceptCallback = null;
        onRejectCallback = null;
    }
    acceptChangesBtn.addEventListener('click', () => {
        if (onAcceptCallback) onAcceptCallback();
        hideDiffModal(true);
    });
    rejectChangesBtn.addEventListener('click', () => hideDiffModal(false));
    closeModalBtn.addEventListener('click', () => hideDiffModal(false));
    diffModal.addEventListener('click', (e) => { if (e.target === diffModal) hideDiffModal(false); });
}

/**
 * 初始化论文写作页面的所有逻辑。
 */
function initPaperWritingPage() {
    // DOM 元素引用
    const mainContent = document.querySelector('.main-content');
    const ideaContainer = document.getElementById('idea-container');
    const paperContainer = document.getElementById('paper-container');
    const promptBar = document.getElementById('prompt-bar');
    const globalPromptInput = document.getElementById('global-prompt-input');
    const submitPromptBtn = document.getElementById('submit-prompt-btn');
    const modelSelect = document.getElementById('paper-model-select');
    const languageSelect = document.getElementById('paper-language-select');
    const tempSlider = document.getElementById('paper-temp-slider');
    const paperSelect = document.getElementById('paper-select');
    const newPaperBtn = document.getElementById('new-paper-btn');
    const renameInput = document.getElementById('rename-input');
    const renameBtn = document.getElementById('rename-paper-btn');
    const deleteBtn = document.getElementById('delete-paper-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const annotationModal = document.getElementById('annotation-modal');
    const annotationInput = document.getElementById('annotation-input');
    const saveAnnotationBtn = document.getElementById('save-annotation-btn');
    const cancelAnnotationBtn = document.getElementById('cancel-annotation-btn');

    // 状态管理变量
    let paperState = {};
    let paperStructure = []; // 将从后端加载配置
    let paperStructureMap = {}; // 用于通过 key 快速查找
    let saveTimeout;
    let editingSection = null;
    let currentPaperId = null;
    let isAIGenerating = false;
    let currentAnnotationCallback = null;
    let floatingToolbar;

    function adjustTextareaHeight(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }

    function renderPaperState() {
        if (!paperStructure.length) return; // 确保在结构加载后才渲染

        paperStructure.forEach(sectionConfig => {
            const key = sectionConfig.key;
            const sectionEl = document.querySelector(`.paper-section[data-key="${key}"]`);
            if (!sectionEl || !paperState[key]) return;

            const sectionData = paperState[key];
            const isLocked = !sectionConfig.dependencies.every(dep => paperState[dep]?.status === 'completed');

            if (sectionData.status !== 'generating') {
                sectionData.status = isLocked ? 'locked' : (sectionData.content.trim() === '' ? 'empty' : 'completed');
            }
            sectionEl.dataset.status = sectionData.status;

            const statusIndicator = sectionEl.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${sectionData.status}`;
                statusIndicator.innerHTML = { 'locked': '<i class="ph ph-lock-simple"></i>', 'completed': '<i class="ph ph-check"></i>', 'empty': '', 'generating': '' }[sectionData.status] || '';
            }

            const depInfo = sectionEl.querySelector('.dependencies-info');
            if (depInfo) {
                depInfo.innerHTML = sectionConfig.dependencies.map(depKey => {
                    const depConfig = paperStructureMap[depKey];
                    const depName = depConfig ? depConfig.name : depKey;
                    const isCompleted = paperState[depKey]?.status === 'completed';
                    const icon = isCompleted ? '<i class="ph ph-check-circle icon"></i>' : '<i class="ph ph-x-circle icon"></i>';
                    return `<span class="dep-item ${isCompleted ? 'completed' : 'pending'}">${icon} ${depName}</span>`;
                }).join(' ') || '无依赖';
            }

            const isEditingThisSection = editingSection === key;
            const displayDiv = sectionEl.querySelector('.content-display');
            const textarea = sectionEl.querySelector('textarea');

            if (displayDiv) {
                displayDiv.style.display = isEditingThisSection ? 'none' : 'block';
                renderMarkdownWithMath(sectionData.content, displayDiv);
            }
            if (textarea) {
                textarea.style.display = isEditingThisSection ? 'block' : 'none';
                if (isEditingThisSection) {
                    textarea.value = sectionData.content;
                    adjustTextareaHeight(textarea);
                }
            }

            const allButtons = sectionEl.querySelectorAll('.section-controls .btn');
            allButtons.forEach(btn => { btn.style.display = 'none'; btn.disabled = isAIGenerating; });

            if (isEditingThisSection) {
                sectionEl.querySelector('.btn-save').style.display = 'inline-block';
                sectionEl.querySelector('.btn-cancel').style.display = 'inline-block';
            } else {
                const isCompleted = sectionData.status === 'completed';
                const isEmpty = sectionData.status === 'empty';
                if (!isLocked) sectionEl.querySelector('.btn-edit').style.display = 'inline-block';
                if (isEmpty) sectionEl.querySelector('.btn-generate').style.display = 'inline-block';
                if (isCompleted) {
                    ['.btn-modify', '.btn-modify-annotated', '.btn-expand', '.btn-polish'].forEach(selector => {
                        const btn = sectionEl.querySelector(selector);
                        if (btn) btn.style.display = 'inline-block';
                    });
                }
            }
        });
        updateToolbarPosition();
    }

    function createInitialStructure() {
        if (!paperStructure.length) return;
        ideaContainer.innerHTML = ''; paperContainer.innerHTML = '';
        let numberedSectionCounter = 1;

        paperStructure.forEach(sectionConfig => {
            const key = sectionConfig.key;
            const titleNumber = sectionConfig.numbered ? `<span class="section-number">${numberedSectionCounter++}.</span>` : '';
            const titleHTML = `<h3 class="paper-section-title">${titleNumber}${sectionConfig.name}</h3>`;
            const sectionControlsHTML = `
                <button class="btn btn-edit" data-section="${key}">编辑</button>
                <button class="btn btn-save" data-section="${key}" style="display:none;">保存</button>
                <button class="btn btn-cancel" data-section="${key}" style="display:none;">取消</button>
                <button class="btn btn-primary btn-generate" data-section="${key}" style="display:none;">生成</button>
                <button class="btn btn-modify" data-section="${key}" style="display:none;">修改</button>
                <button class="btn btn-modify-annotated" data-section="${key}" style="display:none;">批注修改</button>
                <button class="btn btn-expand" data-section="${key}" style="display:none;">扩写</button>
                <button class="btn btn-polish" data-section="${key}" style="display:none;">润色</button>
            `;
            const sectionHTML = `<div class="paper-section" data-key="${key}" id="section-${key}">
                <div class="section-header">
                    <div class="header-left">
                        <div class="status-indicator locked"><i class="ph ph-lock-simple"></i></div>
                        <div class="title-block">
                            ${titleHTML}
                            ${sectionConfig.dependencies.length > 0 ? '<div class="dependencies-info"></div>' : ''}
                        </div>
                    </div>
                    <div class="header-right section-controls">${sectionControlsHTML}</div>
                </div>
                <div class="content-display" data-section="${key}"></div>
                <textarea id="textarea-${key}" data-section="${key}" style="display: none;"></textarea>
            </div>`;

            if (key === 'idea') {
                ideaContainer.insertAdjacentHTML('beforeend', sectionHTML);
            } else {
                paperContainer.insertAdjacentHTML('beforeend', sectionHTML);
            }
        });
    }

    function createFloatingToolbar() {
        floatingToolbar = document.createElement('div');
        floatingToolbar.id = 'floating-editor-toolbar';
        floatingToolbar.innerHTML = `<button class="btn btn-toolbar btn-add-annotation" title="添加批注"><i class="ph ph-pen-nib"></i></button>`;
        document.body.appendChild(floatingToolbar);

        floatingToolbar.querySelector('.btn-add-annotation').addEventListener('click', () => {
            if (!editingSection) return;
            const textarea = document.getElementById(`textarea-${editingSection}`);
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            if (!selectedText) { alert("请先选中文本，再添加批注。"); return; }

            showAnnotationModal('', (comment) => {
                if (comment && comment.trim() !== '') {
                    const scrollTop = textarea.scrollTop;
                    const newText = `{{${selectedText}}}【修改意见：${comment.trim()}】`;
                    const finalCursorPos = start + newText.length;

                    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
                    paperState[editingSection].content = textarea.value;
                    scheduleSave();

                    adjustTextareaHeight(textarea);
                    textarea.scrollTop = scrollTop;
                    textarea.focus();
                    textarea.setSelectionRange(finalCursorPos, finalCursorPos);
                }
            });
        });
    }

    function updateToolbarPosition() {
        if (!floatingToolbar || !editingSection) {
            if (floatingToolbar) floatingToolbar.classList.remove('visible');
            return;
        }
        const textarea = document.getElementById(`textarea-${editingSection}`);
        if (!textarea || !mainContent) {
            floatingToolbar.classList.remove('visible');
            return;
        }

        const taRect = textarea.getBoundingClientRect();
        const mainContentRect = mainContent.getBoundingClientRect();
        const toolbarWidth = floatingToolbar.offsetWidth;
        const toolbarHeight = floatingToolbar.offsetHeight;
        const gap = 15;

        let top = taRect.top + taRect.height / 2 - toolbarHeight / 2;
        let left = taRect.left - toolbarWidth - gap;

        top = Math.max(mainContentRect.top + gap, Math.min(top, mainContentRect.bottom - toolbarHeight - gap));
        left = Math.max(mainContentRect.left + gap, left);

        floatingToolbar.style.top = `${top}px`;
        floatingToolbar.style.left = `${left}px`;
        floatingToolbar.classList.add('visible');
    }


    async function scheduleSave() {
        if (!currentPaperId) return;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/paper/save/${currentPaperId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paperState),
                });
                 if (!response.ok) {
                    const err = await response.json();
                    console.error('自动保存失败:', err.message);
                }
            } catch (error) { console.error('自动保存网络错误:', error); }
        }, 1000);
    }

    async function loadPaperContent(paperId) {
        if (!paperId) {
            paperContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">请新建一篇文章或从上方选择一篇文章开始编辑。</p>';
            ideaContainer.style.display = 'none';
            renameInput.value = '';
            currentPaperId = null;
            return;
        }
        ideaContainer.style.display = 'block';
        try {
            const response = await fetch(`/api/paper/content/${paperId}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || '未能加载论文内容');
            }
            paperState = await response.json();
            currentPaperId = paperId;
            localStorage.setItem('currentPaperId', paperId);

            paperStructure.forEach(section => {
                if (!paperState[section.key]) {
                    paperState[section.key] = { content: '', status: 'locked' };
                }
                 if (paperState[section.key].status === 'generating') {
                    paperState[section.key].status = paperState[section.key].content.trim() ? 'completed' : 'empty';
                }
            });

            renameInput.value = paperState.documentName || '';
            renderPaperState();
        } catch (error) {
            console.error('加载论文数据失败:', error);
            alert(`加载论文数据失败: ${error.message}`);
            // 如果加载失败，可能是文件被删除了，此时应刷新列表
            await loadPaperList();
        }
    }

    async function createNewPaperAndReload() {
        try {
            const response = await fetch('/api/papers/new', { method: 'POST' });
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('currentPaperId', result.paper.id);
                // 直接加载新创建的论文，而不是刷新整个列表，体验更流畅
                await loadPaperList();
            } else {
                 throw new Error(result.message);
            }
        } catch (error) {
            console.error('创建新论文失败:', error);
            alert(`创建新论文失败: ${error.message}`);
        }
    }

    async function loadPaperList() {
        try {
            const response = await fetch('/api/papers/list');
            const papers = await response.json();
            paperSelect.innerHTML = '';

            if (papers.length === 0) {
                // **关键逻辑修复**：如果列表为空，不再只是显示提示，而是自动创建第一篇
                await createNewPaperAndReload();
                return;
            }

            papers.forEach(paper => {
                const option = new Option(paper.documentName, paper.id);
                paperSelect.add(option);
            });
            let idToLoad = localStorage.getItem('currentPaperId');
            if (!papers.some(p => p.id === idToLoad)) {
                idToLoad = papers[0].id;
            }
            paperSelect.value = idToLoad;
            await loadPaperContent(idToLoad);

        } catch (error) {
            console.error('加载论文列表失败:', error);
        }
    }

    function showAnnotationModal(initialValue = '', callback) {
        annotationInput.value = initialValue;
        annotationModal.classList.add('visible');
        annotationInput.focus();
        currentAnnotationCallback = callback;
    }

    function hideAnnotationModal() {
        annotationModal.classList.remove('visible');
        annotationInput.value = '';
        currentAnnotationCallback = null;
    }

    saveAnnotationBtn.addEventListener('click', () => {
        if (currentAnnotationCallback) {
            currentAnnotationCallback(annotationInput.value);
        }
        hideAnnotationModal();
    });
    cancelAnnotationBtn.addEventListener('click', hideAnnotationModal);
    annotationModal.addEventListener('click', (e) => { if (e.target === annotationModal) hideAnnotationModal(); });


    paperSelect.addEventListener('change', () => { const selectedId = paperSelect.value; if (selectedId && selectedId !== currentPaperId) loadPaperContent(selectedId); });
    newPaperBtn.addEventListener('click', createNewPaperAndReload);
    renameBtn.addEventListener('click', async () => { const newName = renameInput.value.trim(); if (!newName || !currentPaperId || newName === currentPaperId) return; try { const response = await fetch(`/api/papers/rename/${currentPaperId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }) }); const result = await response.json(); if (result.status === 'success') { localStorage.setItem('currentPaperId', newName); await loadPaperList(); } else { alert(`重命名失败: ${result.message}`); renameInput.value = currentPaperId; } } catch (error) { console.error('重命名失败:', error); } });
    deleteBtn.addEventListener('click', async () => { if (!currentPaperId) return; if (confirm(`确定要删除文章 "${paperState.documentName}" 吗？此操作无法撤销。`)) { try { await fetch(`/api/papers/delete/${currentPaperId}`, { method: 'DELETE' }); localStorage.removeItem('currentPaperId'); await loadPaperList(); } catch (error) { console.error('删除失败:', error); } } });
    exportPdfBtn.addEventListener('click', () => { if (!currentPaperId) { alert("请先选择一篇要导出的文章。"); return; } const originalTitle = document.title; const paperTitle = paperState.title?.content.trim() || paperState.documentName || '未命名论文'; const safeFileName = paperTitle.replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim(); document.title = safeFileName; window.print(); setTimeout(() => { document.title = originalTitle; }, 1000); });

    function handleInteraction(e) {
        const target = e.target;

        const annotatedText = target.closest('.annotated-text');
        if (annotatedText) {
            e.stopPropagation();
            const existingPopover = document.querySelector('.annotation-popover');
            if (existingPopover) existingPopover.remove();

            const popover = document.createElement('div');
            popover.className = 'annotation-popover';
            popover.innerHTML = `
                <div class="annotation-popover-content">${annotatedText.dataset.comment}</div>
                <div class="annotation-popover-actions">
                    <button class="btn btn-secondary btn-edit-annotation">编辑</button>
                    <button class="btn btn-danger btn-delete-annotation">删除</button>
                </div>
            `;
            document.body.appendChild(popover);
            const rect = annotatedText.getBoundingClientRect();
            popover.style.left = `${rect.left}px`;
            popover.style.top = `${rect.bottom + 8}px`;
            requestAnimationFrame(() => { popover.classList.add('visible'); });

            popover.querySelector('.btn-edit-annotation').addEventListener('click', () => {
                const sectionKey = annotatedText.closest('.paper-section').dataset.key;
                const rawToken = decodeURIComponent(annotatedText.dataset.rawToken);
                showAnnotationModal(annotatedText.dataset.comment, (newComment) => {
                    if (newComment && newComment.trim() !== '') {
                        const newRawToken = rawToken.replace(/【修改意见：([\s\S]+?)】/, `【修改意见：${newComment.trim()}】`);
                        paperState[sectionKey].content = paperState[sectionKey].content.replace(rawToken, newRawToken);
                        renderPaperState();
                        scheduleSave();
                    }
                });
                popover.remove();
            });
            popover.querySelector('.btn-delete-annotation').addEventListener('click', () => {
                const sectionKey = annotatedText.closest('.paper-section').dataset.key;
                const rawToken = decodeURIComponent(annotatedText.dataset.rawToken);
                const textInside = rawToken.match(/^{{([\s\S]+?)}}/)[1];
                paperState[sectionKey].content = paperState[sectionKey].content.replace(rawToken, textInside);
                renderPaperState();
                scheduleSave();
                popover.remove();
            });

            const closePopover = (event) => {
                if (!popover.contains(event.target)) {
                    popover.remove();
                    document.removeEventListener('click', closePopover);
                }
            };
            setTimeout(() => document.addEventListener('click', closePopover), 0);
            return;
        }

        const button = target.closest('button[data-section]');
        if (button) {
            const sectionKey = button.dataset.section;
            const sectionConfig = paperStructureMap[sectionKey];

            if (button.matches('.btn-edit')) { editingSection = sectionKey; renderPaperState(); const textarea = document.getElementById(`textarea-${sectionKey}`); if (textarea) textarea.focus({ preventScroll: true }); return; }
            if (button.matches('.btn-save')) { const textarea = document.getElementById(`textarea-${sectionKey}`); if (textarea) { paperState[sectionKey].content = textarea.value; scheduleSave(); } editingSection = null; renderPaperState(); return; }
            if (button.matches('.btn-cancel')) { editingSection = null; renderPaperState(); return; }

            if (button.matches('.btn-generate')) performSectionAction(sectionKey, 'generate');
            else if (button.matches('.btn-expand')) performSectionAction(sectionKey, 'expand');
            else if (button.matches('.btn-polish')) performSectionAction(sectionKey, 'polish');
            else if (button.matches('.btn-modify-annotated')) performSectionAction(sectionKey, 'modify_annotated');
            else if (button.matches('.btn-modify')) {
                promptBar.style.display = 'flex';
                globalPromptInput.placeholder = `为"${sectionConfig.name}"提供修改指令...`;
                globalPromptInput.focus();
                submitPromptBtn.dataset.section = sectionKey;
            }
            return;
        }

        if (e.type === 'input' && target.matches('textarea[data-section]')) {
            const sectionKey = target.dataset.section;
            paperState[sectionKey].content = target.value;
            adjustTextareaHeight(target);
            scheduleSave();
        }
    }

    document.body.addEventListener('click', handleInteraction);
    document.body.addEventListener('input', handleInteraction);

    async function performSectionAction(sectionKey, actionType, userPrompt = '') {
        if (isAIGenerating) { alert('已有AI任务在执行中，请等待其完成后再试。'); return; }
        if (!currentPaperId) { alert("请先选择或创建一篇文章。"); return; }
        const apiKey = getApiKey(); if (!apiKey) return;

        isAIGenerating = true;
        const originalStatus = paperState[sectionKey].status;
        const originalContent = paperState[sectionKey].content;
        paperState[sectionKey].status = 'generating';
        editingSection = null;
        renderPaperState();
        promptBar.style.display = 'none';
        globalPromptInput.value = '';

        try {
            const response = await fetch('/api/paper/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model: modelSelect.value, temperature: parseFloat(tempSlider.value), language: languageSelect.value, target_section: sectionKey, paper_data: paperState, action_type: actionType, user_prompt: userPrompt }),
            });
            const result = await response.json();
            if (response.ok) {
                showDiffModal(
                    originalContent, result.content,
                    () => { // onAccept
                        paperState[sectionKey].content = result.content;
                        paperState[sectionKey].status = originalStatus;
                        isAIGenerating = false;
                        renderPaperState();
                        scheduleSave();
                    },
                    () => { // onReject
                        paperState[sectionKey].status = originalStatus;
                        isAIGenerating = false;
                        renderPaperState();
                    }
                );
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`操作失败: ${error.message}`);
            paperState[sectionKey].status = originalStatus;
            isAIGenerating = false;
            renderPaperState();
        }
    }

    submitPromptBtn.addEventListener('click', () => {
        const userPrompt = globalPromptInput.value.trim();
        const sectionKey = submitPromptBtn.dataset.section;
        if (userPrompt && sectionKey) performSectionAction(sectionKey, 'modify', userPrompt);
    });
    globalPromptInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPromptBtn.click(); } });

    async function initialize() {
        try {
            const response = await fetch('/api/paper/structure');
            if (!response.ok) throw new Error('无法从服务器加载论文结构。');
            paperStructure = await response.json();
            paperStructure.forEach(s => paperStructureMap[s.key] = s);

            createInitialStructure();
            createFloatingToolbar();
            await loadPaperList();
            mainContent.addEventListener('scroll', updateToolbarPosition);
            window.addEventListener('resize', updateToolbarPosition);
        } catch (error) {
            console.error('页面初始化失败:', error);
            mainContent.innerHTML = `<div class="content-card" style="color: var(--error-color);">
                <h2>页面加载失败</h2>
                <p>无法初始化论文写作模块。请确保后端服务正在运行，并检查浏览器控制台以获取更多错误信息。</p>
                <p><strong>错误详情:</strong> ${error.message}</p>
            </div>`;
        }
    }

    initialize();
}