// static/js/main.js

/**
 * 渲染包含 Markdown 和数学公式的文本。
 *
 * 此函数采用专业、可靠的两阶段渲染流程，以确保内容和公式的精准显示：
 * 1.  **扩展 Marked 解析**：通过自定义扩展，首先识别并保护 LaTeX 公式（行内 `$…$` 和行间 `$$…$$`），
 *     防止 Marked.js 错误地解析公式内部的语法或破坏行间公式的块级结构。
 * 2.  **调用 MathJax排版**：在 Markdown 结构生成后，调用 MathJax 对页面中被保护的
 *     LaTeX 代码进行扫描和高质量的数学排版。
 *
 * 这种方法有效隔离了 Markdown 解析和数学排版，是处理复杂科学文本的业界标准实践。
 *
 * @param {string} rawText - 包含 Markdown 和 LaTeX 的原始字符串。
 * @param {HTMLElement} targetElement - 用于显示渲染后内容的 DOM 元素。
 */
function renderMarkdownWithMath(rawText, targetElement) {
    // 阶段 0: 处理空文本输入，显示占位符或清空。
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

    // 定义 Marked.js 扩展，用于正确处理行间公式（$$...$$）。
    // 此扩展的核心作用是识别出数学公式块，并阻止 Marked 将其错误地包裹在 <p> 标签中。
    const mathBlockExtension = {
        name: 'mathBlock',
        level: 'block', // 这是一个块级扩展。
        start(src) { return src.indexOf('$$'); }, // 优化性能，快速判断是否需要启用此规则。
        tokenizer(src, tokens) {
            // 正则表达式匹配以 '$$' 开头和结尾的块，允许跨行。
            const rule = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'mathBlock', // 自定义Token类型
                    raw: match[0], // 完整的匹配文本，例如 "$$...$$"
                    text: match[1].trim(), // '$$' 内部的公式内容
                };
            }
        },
        renderer(token) {
            // 直接将原始的 '$$...$$' 块返回，供后续的 MathJax 处理。
            return `$$${token.text}$$`;
        },
    };

    // 定义 Marked.js 扩展，用于正确处理行内公式 ($...$)。
    // 此扩展将公式视为一个不可分割的整体（原子Token），防止 Markdown 语法
    // （如斜体 '_'）错误地作用于公式内部的字符。
    const mathInlineExtension = {
        name: 'mathInline',
        level: 'inline', // 这是一个行内扩展。
        start(src) { return src.indexOf('$'); },
        tokenizer(src, tokens) {
            // 正则表达式匹配 '$' 开头和结尾的片段，同时处理转义的 '\$' 且不匹配 '$$'。
            const rule = /^\$((?:\\\$|[^$])+?)\$/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'mathInline',
                    raw: match[0],
                    text: match[1].trim(),
                };
            }
        },
        renderer(token) {
            // 直接将原始的 '$...$' 片段返回。
            return `$${token.text}$`;
        },
    };

    // 创建一个集成了我们自定义数学扩展的 Marked 实例。
    const markedInstance = new marked.Marked().use({
        extensions: [mathBlockExtension, mathInlineExtension],
    });

    // 阶段 1: 使用配置好的 Marked 实例解析 Markdown。
    // 此时，数学公式因扩展的存在而被完整地保留下来。
    const html = markedInstance.parse(rawText);
    targetElement.innerHTML = html;

    // 阶段 2: 通知 MathJax 扫描目标元素并异步渲染其中所有数学公式。
    if (window.MathJax) {
        window.MathJax.typesetPromise([targetElement])
            .catch((err) => console.error('MathJax typesetting error:', err));
    }
}


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
            li.innerHTML = `<span><i class="fas fa-file-pdf"></i> ${paper.filename}</span><span class="status-indicator ${statusClass}">${statusText}</span>`;
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

// --- 综合文献分析页 ---
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


// --- 头脑风暴页 ---
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
            renderMarkdownWithMath(content, outputDiv);
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
            } else { updateUI(null); }
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
                renderMarkdownWithMath(history[historyIndex], outputDiv);
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
            startBtn.disabled = false;
            startBtn.textContent = isModification || history.length > 0 ? '修改头脑风暴' : '开始头脑风暴';
        }
    });
    undoBtn.addEventListener('click', () => { if (historyIndex > 0) { historyIndex--; renderMarkdownWithMath(history[historyIndex], outputDiv); updateHistoryButtons(); } });
    redoBtn.addEventListener('click', () => { if (historyIndex < history.length - 1) { historyIndex++; renderMarkdownWithMath(history[historyIndex], outputDiv); updateHistoryButtons(); } });
    modificationPrompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startBtn.click(); } });
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

        // 与主渲染函数使用完全相同的 Marked.js 实例和扩展，以确保渲染行为一致。
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

            // 优先处理“修改”的情况：即一个 'removed' 块紧跟着一个 'added' 块。
            // 这种情况下，为了清晰展示源码的精确变动，我们不渲染Markdown，而是显示转义后的纯文本。
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
                i++; // 跳过下一个 'added' 部分，因为它已经被处理了。
            } else if (part.added) {
                // 对于纯“添加”的行，我们渲染其行内Markdown。
                lines.forEach(line => {
                    oldPane.appendChild(createLine('empty', null, ''));
                    newPane.appendChild(createLine('added', newLineNum++, markedInstance.parseInline(line)));
                });
            } else if (part.removed) {
                // 对于纯“删除”的行，同样渲染其行内Markdown。
                lines.forEach(line => {
                    oldPane.appendChild(createLine('removed', oldLineNum++, markedInstance.parseInline(line)));
                    newPane.appendChild(createLine('empty', null, ''));
                });
            } else {
                // 对于“上下文”（未改变）的行，也渲染行内Markdown。
                lines.forEach(line => {
                    const renderedLine = markedInstance.parseInline(line);
                    oldPane.appendChild(createLine('context', oldLineNum++, renderedLine));
                    newPane.appendChild(createLine('context', newLineNum++, renderedLine));
                });
            }
        }

        // 在所有差异HTML都生成并插入DOM后，统一调用MathJax进行公式排版。
        if (window.MathJax) {
            window.MathJax.typesetPromise([oldPane, newPane])
                .catch((err) => console.error('MathJax typesetting error in diff modal:', err));
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


function initPaperWritingPage() {
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

    let paperState = {};
    let saveTimeout;
    let editingSection = null;
    let currentPaperId = null;
    let isAIGenerating = false; // 全局锁，防止并发AI请求

    const sections = {
        idea: { name: '核心想法', dependencies: [], number: null }, title: { name: '标题', dependencies: ['idea'], number: null },
        abstract: { name: '摘要', dependencies: ['idea', 'title'], number: null }, keywords: { name: '关键词', dependencies: ['title', 'abstract'], number: null },
        introduction: { name: '引言', dependencies: ['title', 'abstract'], number: '1.' }, background: { name: '理论背景与假设建立', dependencies: ['title', 'abstract'], number: '2.' },
        methods: { name: '研究方法', dependencies: ['title', 'abstract', 'background'], number: '3.' }, results: { name: '结果', dependencies: ['title', 'abstract', 'methods'], number: '4.' },
        discussion: { name: '讨论', dependencies: ['title', 'abstract', 'methods', 'results'], number: '5.' }, conclusion: { name: '结论', dependencies: ['title', 'abstract', 'methods', 'results', 'discussion'], number: '6.' },
    };

    function adjustTextareaHeight(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }

    function renderPaperState() {
        Object.keys(sections).forEach(key => {
            const sectionEl = document.querySelector(`.paper-section[data-key="${key}"]`);
            if (!sectionEl || !paperState[key]) return;
            const sectionConfig = sections[key]; const sectionData = paperState[key];

            // 根据依赖和内容确定状态
            const isLocked = !sectionConfig.dependencies.every(dep => paperState[dep]?.status === 'completed');
            if (sectionData.status !== 'generating') {
                if (isLocked) {
                    sectionData.status = 'locked';
                } else {
                    sectionData.status = sectionData.content.trim() === '' ? 'empty' : 'completed';
                }
            }

            sectionEl.dataset.status = sectionData.status;

            // 更新状态指示器UI
            const statusIndicator = sectionEl.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${sectionData.status}`;
                statusIndicator.innerHTML = { 'locked': '<i class="fas fa-lock"></i>', 'completed': '<i class="fas fa-check"></i>', 'empty': '', 'generating': '' }[sectionData.status] || '';
            }

            // 更新依赖UI
            const depInfo = sectionEl.querySelector('.dependencies-info');
            if (depInfo) depInfo.innerHTML = sectionConfig.dependencies.map(dep => { const isCompleted = paperState[dep]?.status === 'completed'; const icon = isCompleted ? '<i class="fas fa-check-circle icon"></i>' : '<i class="fas fa-times-circle icon"></i>'; return `<span class="dep-item ${isCompleted ? 'completed' : 'pending'}">${icon} ${sections[dep].name}</span>`; }).join(' ') || '无依赖';

            // 切换显示和编辑模式
            const isEditingThisSection = editingSection === key;
            const displayDiv = sectionEl.querySelector('.content-display');
            if (displayDiv) {
                displayDiv.style.display = isEditingThisSection ? 'none' : 'block';
                renderMarkdownWithMath(sectionData.content, displayDiv);
            }
            const textarea = sectionEl.querySelector('textarea');
            if (textarea) {
                textarea.style.display = isEditingThisSection ? 'block' : 'none';
                if (isEditingThisSection) { textarea.value = sectionData.content; adjustTextareaHeight(textarea); textarea.focus(); }
            }

            // 更新操作按钮的可见性和状态
            const generateBtn = sectionEl.querySelector('.btn-generate'), modifyBtn = sectionEl.querySelector('.btn-modify'), expandBtn = sectionEl.querySelector('.btn-expand'), polishBtn = sectionEl.querySelector('.btn-polish');
            const allActionButtons = [generateBtn, modifyBtn, expandBtn, polishBtn].filter(Boolean);

            allActionButtons.forEach(btn => btn.disabled = isAIGenerating);

            const showActionButtons = sectionData.status === 'completed' && !isEditingThisSection;
            if (generateBtn) generateBtn.style.display = (sectionData.status === 'empty' && !isEditingThisSection) ? 'inline-block' : 'none';
            if (modifyBtn) modifyBtn.style.display = showActionButtons ? 'inline-block' : 'none';
            if (expandBtn) expandBtn.style.display = showActionButtons ? 'inline-block' : 'none';
            if (polishBtn) polishBtn.style.display = showActionButtons ? 'inline-block' : 'none';
        });
    }

    function createInitialStructure() {
        ideaContainer.innerHTML = ''; paperContainer.innerHTML = '';
        for (const key in sections) {
            const sectionConfig = sections[key];
            const titleNumber = sectionConfig.number ? `<span class="section-number">${sectionConfig.number}</span>` : '';
            const titleHTML = `<h3 class="paper-section-title">${titleNumber}${sectionConfig.name}</h3>`;
            const sectionControlsHTML = key === 'idea' ? '' : `
                <button class="btn btn-primary btn-generate" data-section="${key}">生成</button>
                <button class="btn btn-secondary btn-modify" data-section="${key}">修改</button>
                <button class="btn btn-expand" data-section="${key}">扩写</button>
                <button class="btn btn-polish" data-section="${key}">润色</button>
            `;
            const sectionHTML = `<div class="paper-section" data-key="${key}" id="section-${key}"><div class="section-header"><div class="header-left"><div class="status-indicator locked"><i class="fas fa-lock"></i></div><div class="title-block">${titleHTML}${sectionConfig.dependencies.length > 0 ? '<div class="dependencies-info"></div>' : ''}</div></div><div class="header-right section-controls">${sectionControlsHTML}</div></div><div class="content-display" data-section="${key}"></div><textarea id="textarea-${key}" data-section="${key}" style="display: none;"></textarea></div>`;

            if (key === 'idea') ideaContainer.insertAdjacentHTML('beforeend', sectionHTML);
            else paperContainer.insertAdjacentHTML('beforeend', sectionHTML);
        }
    }

    async function scheduleSave() {
        if (!currentPaperId) return;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                await fetch(`/api/paper/save/${currentPaperId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paperState),
                });
            } catch (error) { console.error('自动保存失败:', error); }
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
            if (!response.ok) throw new Error('未能加载论文内容');
            paperState = await response.json();
            currentPaperId = paperId;
            localStorage.setItem('currentPaperId', paperId);

            Object.keys(paperState).forEach(key => {
                if (paperState[key] && paperState[key].status === 'generating') {
                    paperState[key].status = paperState[key].content.trim() ? 'completed' : 'empty';
                }
            });

            renameInput.value = paperState.documentName || '';
            renderPaperState();
        } catch (error) {
            console.error('加载论文数据失败:', error);
            alert('加载论文数据失败，请重试。');
        }
    }

    async function loadPaperList() {
        try {
            const response = await fetch('/api/papers/list');
            const papers = await response.json();
            paperSelect.innerHTML = '';
            if (papers.length === 0) {
                paperSelect.innerHTML = '<option value="">无可用文章</option>';
                currentPaperId = null;
                localStorage.removeItem('currentPaperId');
                await loadPaperContent(null);
            } else {
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
            }
        } catch (error) {
            console.error('加载论文列表失败:', error);
        }
    }

    paperSelect.addEventListener('change', () => {
        const selectedId = paperSelect.value;
        if (selectedId && selectedId !== currentPaperId) {
            loadPaperContent(selectedId);
        }
    });

    newPaperBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/papers/new', { method: 'POST' });
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('currentPaperId', result.paper.id);
                await loadPaperList();
            }
        } catch (error) { console.error('创建新论文失败:', error); }
    });

    renameBtn.addEventListener('click', async () => {
        const newName = renameInput.value.trim();
        if (!newName || !currentPaperId) return;
        if (newName === currentPaperId) return;

        try {
            const response = await fetch(`/api/papers/rename/${currentPaperId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName })
            });
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('currentPaperId', newName);
                await loadPaperList();
            } else {
                alert(`重命名失败: ${result.message}`);
                renameInput.value = currentPaperId;
            }
        } catch (error) { console.error('重命名失败:', error); }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!currentPaperId) return;
        if (confirm(`确定要删除文章 "${paperState.documentName}" 吗？此操作无法撤销。`)) {
            try {
                await fetch(`/api/papers/delete/${currentPaperId}`, { method: 'DELETE' });
                localStorage.removeItem('currentPaperId');
                await loadPaperList();
            } catch (error) { console.error('删除失败:', error); }
        }
    });

    exportPdfBtn.addEventListener('click', () => {
        if (!currentPaperId) {
            alert("请先选择一篇要导出的文章。");
            return;
        }

        const elementToPrint = document.createElement('div');
        const ideaNode = document.getElementById('idea-container').cloneNode(true);
        const paperNode = document.getElementById('paper-container').cloneNode(true);

        // 清理克隆的节点以获得更干净的PDF输出
        [ideaNode, paperNode].forEach(container => {
            container.querySelectorAll('.section-controls, .dependencies-info, .status-indicator').forEach(el => el.remove());
        });

        elementToPrint.appendChild(ideaNode);
        elementToPrint.appendChild(paperNode);

        const paperName = paperState.documentName || 'untitled-paper';
        const title = paperState.title?.content.trim();
        const fileName = (title || paperName).replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase() + '.pdf';

        const opt = {
            margin:       [0.8, 0.8, 0.8, 0.8], // inches [top, left, bottom, right]
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', '.paper-section'] }
        };

        const worker = html2pdf().from(elementToPrint).set(opt);

        const buttonOriginalText = exportPdfBtn.innerHTML;
        exportPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在生成...';
        exportPdfBtn.disabled = true;

        worker.save().then(() => {
            exportPdfBtn.innerHTML = buttonOriginalText;
            exportPdfBtn.disabled = false;
        }).catch(err => {
            console.error("PDF export failed:", err);
            alert("导出 PDF 时发生错误，请查看控制台。");
            exportPdfBtn.innerHTML = buttonOriginalText;
            exportPdfBtn.disabled = false;
        });
    });


    function handleInteraction(e) {
        const target = e.target;
        const button = target.closest('button[data-section]');
        if (button) {
            const sectionKey = button.dataset.section;
            if (button.matches('.btn-generate')) performSectionAction(sectionKey, 'generate');
            else if (button.matches('.btn-expand')) performSectionAction(sectionKey, 'expand');
            else if (button.matches('.btn-polish')) performSectionAction(sectionKey, 'polish');
            else if (button.matches('.btn-modify')) {
                promptBar.style.display = 'flex';
                globalPromptInput.placeholder = `为"${sections[sectionKey].name}"提供修改指令...`;
                globalPromptInput.focus();
                submitPromptBtn.dataset.section = sectionKey;
            } return;
        }
        const displayDiv = target.closest('.content-display[data-section]');
        if (displayDiv) {
            const sectionKey = displayDiv.dataset.section;
            if (paperState[sectionKey].status !== 'locked') { editingSection = sectionKey; renderPaperState(); } return;
        }
        if (target.matches('textarea[data-section]')) {
            const sectionKey = target.dataset.section;
            paperState[sectionKey].content = target.value;
            adjustTextareaHeight(target); scheduleSave();
        }
    }
    document.body.addEventListener('click', handleInteraction);
    document.body.addEventListener('input', handleInteraction);
    document.body.addEventListener('focusout', (e) => {
        if (e.target.matches('textarea')) {
            editingSection = null; renderPaperState();
        }
    });

    async function performSectionAction(sectionKey, actionType, userPrompt = '') {
        if (isAIGenerating) {
            alert('已有AI任务在执行中，请等待其完成后再试。');
            return;
        }
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
                        // 必须在此处将状态从 'generating' 移出，
                        // 以便 renderPaperState 能够正确地重新计算其最终状态 (completed/empty)。
                        paperState[sectionKey].status = originalStatus;
                        isAIGenerating = false;
                        renderPaperState();
                        scheduleSave();
                    },
                    () => { // onReject or Close
                        paperState[sectionKey].status = originalStatus;
                        isAIGenerating = false;
                        renderPaperState();
                    }
                );
            } else {
                alert(`操作失败: ${result.message}`);
                paperState[sectionKey].status = originalStatus;
                isAIGenerating = false;
                renderPaperState();
            }
        } catch (error) {
            alert(`网络错误: ${error}`);
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
        createInitialStructure();
        await loadPaperList();
    }

    window.addEventListener('resize', () => { document.querySelectorAll('.paper-section textarea').forEach(adjustTextareaHeight); });

    initialize();
}