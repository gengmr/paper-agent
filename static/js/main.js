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
 * 根据当前页面的URL路径，调用相应的初始化函数。
 */
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/') initIndexPage();
    else if (path.includes('single_literature_analysis')) initSingleAnalysisPage();
    else if (path.includes('comprehensive_literature_analysis')) initComprehensiveAnalysisPage();
    else if (path.includes('brainstorming')) initBrainstormingPage();
    else if (path.includes('paper_writing')) initPaperWritingPage();

    // 为所有范围滑块（range slider）添加事件监听，以实时更新其值显示。
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
 * 从浏览器的 localStorage 中安全地获取 API Key。
 * @returns {string|null} 如果找到，则返回 API Key；否则返回 null 并弹窗提示。
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
 * 初始化首页逻辑，负责 API Key 的保存和加载。
 */
function initIndexPage() {
    const apiKeyInput = document.getElementById('api-key-input');
    const saveBtn = document.getElementById('save-api-key-btn');
    const statusEl = document.getElementById('api-key-status');

    // 页面加载时，尝试从 localStorage 读取已保存的密钥
    const savedKey = localStorage.getItem('googleApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        statusEl.textContent = '已加载保存的API Key。';
        statusEl.className = 'status-message success';
    }

    // 保存按钮点击事件
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
 * 负责获取文件列表、处理文件分析请求和更新UI状态。
 */
function initSingleAnalysisPage() {
    const paperListContainer = document.getElementById('paper-list-container');
    const startBtn = document.getElementById('start-single-analysis-btn');
    const progressLog = document.getElementById('progress-log');

    /** 获取并渲染 `papers` 目录下的PDF文件列表。 */
    async function fetchPapers() {
        try {
            const response = await fetch('/api/papers');
            const papers = await response.json();
            renderPaperList(papers);
        } catch (error) {
            paperListContainer.innerHTML = `<p style="color: var(--error-color);">加载文件列表失败: ${error}</p>`;
        }
    }

    /**
     * 根据文件数据渲染列表UI。
     * @param {Array} papers - 从后端获取的文件状态对象数组。
     */
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

    /**
     * 在日志区域记录一条消息。
     * @param {string} message - 要记录的消息内容。
     * @param {string} [type='info'] - 消息类型 ('info', 'success', 'error')。
     */
    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (type === 'error') p.style.color = 'var(--error-color)';
        else if (type === 'success') p.style.color = 'var(--success-color)';
        progressLog.appendChild(p);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    /**
     * 更新文件列表项的UI状态。
     * @param {string} filename - 要更新的文件名。
     * @param {string} status - 新的状态 ('processing', 'processed', 'failed')。
     * @param {string} message - 显示在状态指示器上的文本。
     */
    function updateFileStatus(filename, status, message) {
        const li = document.querySelector(`li[data-filename="${filename}"]`);
        if (!li) return;
        const indicator = li.querySelector('.status-indicator');
        indicator.className = `status-indicator status-${status}`;
        indicator.textContent = message;
    }

    // "开始分析"按钮的点击事件处理
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

    /** 获取并渲染已存在的综合报告。 */
    async function fetchExistingReport() {
        try {
            const response = await fetch('/api/comprehensive_report');
            const data = await response.json();
            renderMarkdownWithMath(data.content, reportOutput);
        } catch (error) { reportOutput.innerHTML = `<p style="color: var(--error-color);">加载报告失败: ${error}</p>`; }
    }

    /** 获取并渲染已完成单篇分析的文献列表。 */
    async function fetchAnalyzedPapers() {
        try {
            const response = await fetch('/api/analyzed_papers');
            const papers = await response.json();
            renderAnalyzedPaperList(papers);
        } catch (error) { paperListContainer.innerHTML = `<p style="color: var(--error-color);">加载已分析文献列表失败: ${error}</p>`;}
    }

    /**
     * 根据已分析文献数据渲染带复选框的列表。
     * @param {Array<string>} papers - 文件名（无扩展名）数组。
     */
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

    // "生成综述"按钮点击事件
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
 * 管理生成、修改、历史记录（撤销/重做）等交互。
 */
function initBrainstormingPage() {
    let history = []; // 存储内容历史记录
    let historyIndex = -1; // 当前历史记录指针
    const generateBtn = document.getElementById('start-brainstorming-btn');
    const outputDiv = document.getElementById('brainstorming-output');
    const modificationBar = document.getElementById('modification-bar');
    const modificationPrompt = document.getElementById('modification-prompt');
    const submitModificationBtn = document.getElementById('submit-modification-btn');
    const historyControls = document.getElementById('history-controls');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const analysisBasisP = document.getElementById('analysis-basis');

    /** 根据当前历史记录状态更新撤销和重做按钮的可用性。 */
    function updateHistoryButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    /**
     * 根据内容更新整个页面的UI状态。
     * @param {string|null} content - 要显示的内容，如果为null则显示初始状态。
     */
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

    /** 加载页面时获取已有的头脑风暴结果。 */
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

    /**
     * 执行头脑风暴操作（初次生成或修改）。
     * @param {boolean} [isModification=false] - 指示是初次生成还是基于现有内容进行修改。
     */
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
                history = history.slice(0, historyIndex + 1); // 产生新内容时，清除旧的"重做"历史
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

    /**
     * 显示一个精细化的、字符级的差异对比模态框。
     *
     * @param {string} originalText - 原始文本。
     * @param {string} newText - 修改后的新文本。
     * @param {Function} onAccept - 用户点击“接受新版本”时执行的回调函数。
     * @param {Function} onReject - 用户关闭或点击“放弃更改”时执行的回调函数。
     */
    function showDiffModal(originalText, newText, onAccept, onReject) {
        const oldPane = document.getElementById('diff-output-old');
        const newPane = document.getElementById('diff-output-new');
        oldPane.innerHTML = '';
        newPane.innerHTML = '';

        const markedInstance = new marked.Marked().use({ extensions: [ /* MathJax 扩展等 */ ] });
        const escapeHtml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // 核心算法：首先按行分割，然后对有差异的行块进行字符级对比
        const lineDiff = Diff.diffLines(originalText, newText);
        let oldLineNum = 1, newLineNum = 1;

        const createLine = (pane, type, number, content) => {
            const lineEl = document.createElement('div');
            lineEl.className = `diff-line ${type}`;
            lineEl.innerHTML = `<span class="line-number">${number || ''}</span><div class="line-content">${content || ''}</div>`;
            pane.appendChild(lineEl);
        };

        for (let i = 0; i < lineDiff.length; i++) {
            const part = lineDiff[i];
            const nextPart = (i + 1 < lineDiff.length) ? lineDiff[i + 1] : null;

            // 模式1: 检测到一个“删除块”紧跟着一个“增加块”，这通常意味着“修改”
            if (part.removed && nextPart && nextPart.added) {
                // 对这两个块进行字符级对比
                const charDiff = Diff.diffChars(part.value, nextPart.value);
                let oldContent = '';
                let newContent = '';

                charDiff.forEach(charPart => {
                    const escapedValue = escapeHtml(charPart.value);
                    if (charPart.added) {
                        newContent += `<ins>${escapedValue}</ins>`;
                    } else if (charPart.removed) {
                        oldContent += `<del>${escapedValue}</del>`;
                    } else {
                        oldContent += escapedValue;
                        newContent += escapedValue;
                    }
                });

                // 将字符对比结果按换行符重新分割成行
                const oldLines = oldContent.replace(/\n$/, '').split('\n');
                const newLines = newContent.replace(/\n$/, '').split('\n');
                const maxLines = Math.max(oldLines.length, newLines.length);

                for (let j = 0; j < maxLines; j++) {
                    createLine(oldPane, 'removed', oldLineNum++, oldLines[j]);
                    createLine(newPane, 'added', newLineNum++, newLines[j]);
                }
                i++; // 跳过下一个 part，因为它已经被处理了

            // 模式2: 纯增加的行块
            } else if (part.added) {
                const lines = part.value.replace(/\n$/, '').split('\n');
                lines.forEach(line => {
                    createLine(newPane, 'added', newLineNum++, `<ins>${escapeHtml(line)}</ins>`);
                    createLine(oldPane, 'empty', null, '');
                });

            // 模式3: 纯删除的行块
            } else if (part.removed) {
                const lines = part.value.replace(/\n$/, '').split('\n');
                lines.forEach(line => {
                    createLine(oldPane, 'removed', oldLineNum++, `<del>${escapeHtml(line)}</del>`);
                    createLine(newPane, 'empty', null, '');
                });

            // 模式4: 未改变的上下文行
            } else {
                const lines = part.value.replace(/\n$/, '').split('\n');
                lines.forEach(line => {
                    const renderedLine = markedInstance.parseInline(line);
                    createLine(oldPane, 'context', oldLineNum++, renderedLine);
                    createLine(newPane, 'context', newLineNum++, renderedLine);
                });
            }
        }

        // 渲染完成后，调用 MathJax 排版公式，并设置同步滚动
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

    /** 隐藏差异对比模态框，并根据情况执行回调。 */
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
 * 这是一个复杂的函数，负责管理整个页面的状态、DOM渲染和用户交互。
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
    let paperState = {}; // 存储当前论文所有章节的内容和状态
    let paperStructure = []; // 从后端加载的论文结构配置
    let paperStructureMap = {}; // 便于通过 key 快速查找结构配置
    let saveTimeout; // 用于自动保存的延迟计时器
    let editingSection = null; // 当前正在编辑的章节key
    let currentPaperId = null; // 当前加载的论文ID
    let isAIGenerating = false; // AI是否正在生成内容的标志，防止并发请求
    let currentAnnotationCallback = null; // 存储批注模态框的回调
    let floatingToolbar; // 浮动工具栏的DOM引用

    /** 动态调整 textarea 的高度以适应其内容。 */
    function adjustTextareaHeight(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }

    /** 根据当前的 `paperState` 渲染整个论文的UI。 */
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

            // 更新状态指示器
            const statusIndicator = sectionEl.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${sectionData.status}`;
                statusIndicator.innerHTML = { 'locked': '<i class="ph ph-lock-simple"></i>', 'completed': '<i class="ph ph-check"></i>', 'empty': '', 'generating': '' }[sectionData.status] || '';
            }

            // 更新依赖信息
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

            // 切换显示/编辑模式
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

            // 根据状态动态显示/隐藏控制按钮
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
                    ['.btn-modify', '.btn-ai-annotate', '.btn-modify-annotated', '.btn-expand', '.btn-polish'].forEach(selector => {
                        const btn = sectionEl.querySelector(selector);
                        if (btn) btn.style.display = 'inline-block';
                    });
                }
            }
        });
        updateToolbarPosition();
    }

    /** 根据 `paperStructure` 配置，在DOM中创建论文的骨架结构。 */
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
                <button class="btn btn-ai-annotate" data-section="${key}" style="display:none;">AI批注</button>
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

    /** 创建并初始化浮动编辑工具栏。 */
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

    /** 更新浮动工具栏的位置，使其紧邻当前编辑的文本框。 */
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

    /**
     * 安排一个延迟的保存操作。
     * 在用户停止输入1秒后自动向后端保存数据，避免频繁请求。
     */
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

    /**
     * 从后端加载指定ID的论文内容。
     * @param {string} paperId - 要加载的论文的ID。
     */
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

            // 数据清洗：确保所有章节都存在，并重置可能残留的 'generating' 状态
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
            await loadPaperList(); // 如果加载失败，刷新列表
        }
    }

    /** 创建一篇新论文并重新加载论文列表。 */
    async function createNewPaperAndReload() {
        try {
            const response = await fetch('/api/papers/new', { method: 'POST' });
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('currentPaperId', result.paper.id);
                await loadPaperList(); // 重新加载列表以显示新论文
            } else {
                 throw new Error(result.message);
            }
        } catch (error) {
            console.error('创建新论文失败:', error);
            alert(`创建新论文失败: ${error.message}`);
        }
    }

    /** 从后端加载所有论文的列表，并更新下拉选择框。 */
    async function loadPaperList() {
        try {
            const response = await fetch('/api/papers/list');
            const papers = await response.json();
            paperSelect.innerHTML = '';

            if (papers.length === 0) {
                // 如果一篇论文都没有，自动创建第一篇
                await createNewPaperAndReload();
                return;
            }

            papers.forEach(paper => {
                const option = new Option(paper.documentName, paper.id);
                paperSelect.add(option);
            });
            // 尝试加载上次打开的论文，如果不存在则加载第一篇
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

    /** 显示批注编辑模态框。 */
    function showAnnotationModal(initialValue = '', callback) {
        annotationInput.value = initialValue;
        annotationModal.classList.add('visible');
        annotationInput.focus();
        currentAnnotationCallback = callback;
    }

    /** 隐藏批注编辑模态框。 */
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


    // --- 事件监听器绑定 ---
    paperSelect.addEventListener('change', () => { const selectedId = paperSelect.value; if (selectedId && selectedId !== currentPaperId) loadPaperContent(selectedId); });
    newPaperBtn.addEventListener('click', createNewPaperAndReload);
    renameBtn.addEventListener('click', async () => { const newName = renameInput.value.trim(); if (!newName || !currentPaperId || newName === currentPaperId) return; try { const response = await fetch(`/api/papers/rename/${currentPaperId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }) }); const result = await response.json(); if (result.status === 'success') { localStorage.setItem('currentPaperId', newName); await loadPaperList(); } else { alert(`重命名失败: ${result.message}`); renameInput.value = currentPaperId; } } catch (error) { console.error('重命名失败:', error); } });
    deleteBtn.addEventListener('click', async () => { if (!currentPaperId) return; if (confirm(`确定要删除文章 "${paperState.documentName}" 吗？此操作无法撤销。`)) { try { await fetch(`/api/papers/delete/${currentPaperId}`, { method: 'DELETE' }); localStorage.removeItem('currentPaperId'); await loadPaperList(); } catch (error) { console.error('删除失败:', error); } } });
    exportPdfBtn.addEventListener('click', () => { if (!currentPaperId) { alert("请先选择一篇要导出的文章。"); return; } const originalTitle = document.title; const paperTitle = paperState.title?.content.trim() || paperState.documentName || '未命名论文'; const safeFileName = paperTitle.replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim(); document.title = safeFileName; window.print(); setTimeout(() => { document.title = originalTitle; }, 1000); });

    /**
     * 中心化的交互事件处理器。
     * 使用事件委托处理所有按钮点击和文本输入事件。
     */
    function handleInteraction(e) {
        const target = e.target;

        // 处理批注文本的点击事件，显示详情弹窗
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

        // 处理章节控制按钮的点击事件
        const button = target.closest('button[data-section]');
        if (button) {
            const sectionKey = button.dataset.section;
            const sectionConfig = paperStructureMap[sectionKey];

            if (button.matches('.btn-edit')) { editingSection = sectionKey; renderPaperState(); const textarea = document.getElementById(`textarea-${sectionKey}`); if (textarea) textarea.focus({ preventScroll: true }); return; }
            if (button.matches('.btn-save')) { const textarea = document.getElementById(`textarea-${sectionKey}`); if (textarea) { paperState[sectionKey].content = textarea.value; scheduleSave(); } editingSection = null; renderPaperState(); return; }
            if (button.matches('.btn-cancel')) { editingSection = null; renderPaperState(); return; }

            // 触发AI操作
            if (button.matches('.btn-generate')) performSectionAction(sectionKey, 'generate');
            else if (button.matches('.btn-expand')) performSectionAction(sectionKey, 'expand');
            else if (button.matches('.btn-polish')) performSectionAction(sectionKey, 'polish');
            else if (button.matches('.btn-ai-annotate')) performSectionAction(sectionKey, 'ai_annotate');
            else if (button.matches('.btn-modify-annotated')) performSectionAction(sectionKey, 'modify_annotated');
            else if (button.matches('.btn-modify')) {
                promptBar.style.display = 'flex';
                globalPromptInput.placeholder = `为"${sectionConfig.name}"提供修改指令...`;
                globalPromptInput.focus();
                submitPromptBtn.dataset.section = sectionKey;
            }
            return;
        }

        // 处理 textarea 的输入事件，用于自动保存
        if (e.type === 'input' && target.matches('textarea[data-section]')) {
            const sectionKey = target.dataset.section;
            paperState[sectionKey].content = target.value;
            adjustTextareaHeight(target);
            scheduleSave();
        }
    }

    document.body.addEventListener('click', handleInteraction);
    document.body.addEventListener('input', handleInteraction);

    /**
     * 调用后端API执行AI操作（生成、修改、扩写等）。
     * @param {string} sectionKey - 目标章节的key。
     * @param {string} actionType - 操作类型。
     * @param {string} [userPrompt=''] - 用户提供的修改指令（仅用于'modify'类型）。
     */
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
                // 操作成功后，显示差异对比模态框
                showDiffModal(
                    originalContent, result.content,
                    () => { // onAccept: 用户接受更改
                        paperState[sectionKey].content = result.content;
                        paperState[sectionKey].status = originalStatus;
                        isAIGenerating = false;
                        renderPaperState();
                        scheduleSave();
                    },
                    () => { // onReject: 用户放弃更改
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

    // 全局修改指令提交按钮
    submitPromptBtn.addEventListener('click', () => {
        const userPrompt = globalPromptInput.value.trim();
        const sectionKey = submitPromptBtn.dataset.section;
        if (userPrompt && sectionKey) performSectionAction(sectionKey, 'modify', userPrompt);
    });
    globalPromptInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPromptBtn.click(); } });

    /** 页面加载时的总初始化函数。 */
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