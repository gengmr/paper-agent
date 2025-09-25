# app.py
from flask import Flask, render_template, request, jsonify
from pathlib import Path

# 导入我们的服务模块
from services import file_service, llm_service

app = Flask(__name__)


# --- 页面路由 ---

@app.route('/')
def index():
    """渲染首页"""
    return render_template('index.html')


@app.route('/<page_name>')
def page(page_name):
    """动态渲染指定的功能页面"""
    template_map = {
        "single_literature_analysis": "single_literature_analysis.html",
        "comprehensive_literature_analysis": "comprehensive_literature_analysis.html",
        "brainstorming": "brainstorming.html",
        "paper_writing": "paper_writing.html",
    }
    template_file = template_map.get(page_name)
    if template_file:
        return render_template(template_file)
    return render_template('index.html')


# --- API 路由 (原有功能) ---

@app.route('/api/papers', methods=['GET'])
def get_papers():
    """API: 获取PDF文件列表及其处理状态"""
    papers = file_service.get_paper_status_list()
    return jsonify(papers)


@app.route('/api/single_analysis/process_file', methods=['POST'])
def process_single_file():
    """API: 处理单个指定的PDF文件"""
    data = request.json
    api_key = data.get('apiKey')
    filename = data.get('filename')

    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。请在首页设置API Key。"}), 400
    if not filename:
        return jsonify({"status": "error", "message": "未指定要处理的文件名。"}), 400

    model = data.get('model', 'gemini-2.5-flash')
    temperature_markdown = float(data.get('temperature_markdown', 0.0))
    temperature_analysis = float(data.get('temperature_analysis', 1.0))

    try:
        file_stem = Path(filename).stem
        file_path = file_service.PAPERS_DIR / filename

        if not file_path.exists():
            return jsonify({"status": "error", "message": f"文件 {filename} 未在服务器上找到。"}), 404

        markdown_path = file_service.MARKDOWNS_DIR / f"{file_stem}.md"
        if not markdown_path.exists():
            prompt_markdown = "请将这篇PDF论文的内容，包括文本、表格、公式等，完整地转换为结构清晰的Markdown格式。请保留原始的章节结构。"
            markdown_content = llm_service.analyze_pdf_content(file_path, prompt_markdown, model, temperature_markdown,
                                                               api_key)
            file_service.save_markdown_result(file_stem, markdown_content)

        analysis_path = file_service.ANALYSES_DIR / f"{file_stem}.md"
        if not analysis_path.exists():
            prompt_analysis = """请对这篇PDF论文进行深入、专业的学术分析，并以Markdown格式返回。分析应包括以下几个方面：
1.  **核心研究问题**: 本文试图解决的关键科学问题是什么？
2.  **主要创新点/贡献**: 本文最主要的学术贡献和创新之处在哪里？
3.  **研究方法**: 作者采用了什么关键技术、模型或实验方法？方法的优缺点是什么？
4.  **核心结论**: 文章得出了哪些重要结论？
5.  **潜在不足与未来展望**: 本文存在哪些局限性？未来可以从哪些方向进一步研究？"""
            analysis_content = llm_service.analyze_pdf_content(file_path, prompt_analysis, model, temperature_analysis,
                                                               api_key)
            file_service.save_analysis_result(file_stem, analysis_content)

        return jsonify({"status": "success", "message": f"文件 {filename} 处理成功。"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/analyzed_papers', methods=['GET'])
def get_analyzed_papers_api():
    """API: 获取已分析的文献列表"""
    papers = file_service.get_analyzed_papers()
    return jsonify(papers)


@app.route('/api/comprehensive_report', methods=['GET'])
def get_comprehensive_report():
    """API: 获取已存在的综合报告内容"""
    content = file_service.get_comprehensive_report_content()
    return jsonify({"content": content})


@app.route('/api/comprehensive_analysis/start', methods=['POST'])
def start_comprehensive_analysis():
    """API: 启动综合文献分析，并覆盖保存报告"""
    data = request.json
    api_key = data.get('apiKey')
    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。请在首页设置API Key。"}), 400

    model = data.get('model', 'gemini-2.5-pro')
    temperature = float(data.get('temperature', 1.0))
    selected_papers = data.get('papers', [])

    if not selected_papers:
        return jsonify({"status": "error", "message": "请至少选择一篇文献进行分析。"}), 400

    try:
        combined_text = file_service.get_combined_analysis_text(selected_papers)
        if not combined_text:
            return jsonify({"status": "error", "message": "未能读取所选文献的分析内容。"}), 500

        prompt = f"""你是一位顶尖的科研学者，你的任务是基于以下提供的多篇文献分析报告，撰写一份全面而深刻的综合性文献综述报告。

请遵循以下结构和要求，以Markdown格式输出：
1.  **引言**: 简要介绍该研究领域的背景和重要性。
2.  **研究热点与核心主题**: 综合所有文献，识别并总结出当前研究领域的主要热点和反复出现的核心主题。
3.  **主流方法与技术路径**: 归纳这些研究中采用的主流研究方法、模型或技术，并比较它们的优劣。
4.  **共识与争议**: 总结学界在哪些问题上已基本形成共识，以及存在哪些尚未解决的争议或矛盾的观点。
5.  **研究空白与未来方向**: 基于现有研究的局限性，敏锐地指出当前研究中存在的空白（Gaps），并提出几个具有前景的未来研究方向。
6.  **结论**: 对整个领域的现状进行简要总结。

--- 以下是待分析的文献报告 ---
{combined_text}
"""
        report_content = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_comprehensive_report(report_content)

        return jsonify({"status": "success", "message": "综合分析报告 'Comprehensive_Report.md' 已生成/更新。",
                        "report": report_content})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/brainstorming/result', methods=['GET'])
def get_brainstorming_result():
    """API: 获取已有的头脑风暴结果"""
    content = file_service.get_brainstorming_result_content()
    return jsonify({"content": content})


@app.route('/api/brainstorming/start', methods=['POST'])
def start_brainstorming():
    """API: 基于综合报告和单篇分析进行深度头脑风暴，支持初次生成和后续修改。"""
    data = request.json
    api_key = data.get('apiKey')
    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。请在首页设置API Key。"}), 400

    model = data.get('model', 'gemini-2.5-pro')
    temperature = float(data.get('temperature', 1.0))
    existing_results = data.get('existing_results')
    modification_prompt = data.get('modification_prompt')

    try:
        if modification_prompt and existing_results:
            prompt = f"""你是一位顶尖的科研学者。请基于下面提供的“原始研究课题”和用户的“修改指令”，对研究课题进行优化和调整。
请保持原有格式，并以Markdown格式返回修改后的完整内容。

--- 原始研究课题 ---
{existing_results}

--- 修改指令 ---
{modification_prompt}
"""
        else:
            source_text, error_message = file_service.get_brainstorming_source_text()
            if error_message:
                return jsonify({"status": "error", "message": error_message}), 404
            prompt = f"""作为一名顶尖的战略科学家，你的任务是基于以下提供的两类信息，提出5个最具研究价值的创新性研究课题。
信息源说明:
1.  **综合分析报告 (宏观视角)**: 这份报告总结了研究领域的整体趋势、热点和已知的研究空白。
2.  **各单篇文献分析详情 (微观细节)**: 这些是每篇论文的深入分析，包含具体的方法、结论和局限性。
你的核心任务: 综合利用宏观报告的广度和微观细节的深度。请特别关注那些在单篇分析中提到但可能在宏观报告中被忽略的细微矛盾、特定方法的局限性或新兴的苗头。你的目标是找到真正“深藏”的研究机会。
每个课题都必须满足以下条件:
- **创新性 (Novelty)**: 必须是报告中明确指出的研究空白或现有研究的延伸，避免重复。
- **可行性 (Feasibility)**: 提出的研究问题在理论上和技术上应是可行的。
- **重要性 (Significance)**: 解决该问题应对该领域产生重要影响。
- **清晰具体**: 问题应表述清晰、范围明确。

请以以下格式返回结果:
**研究课题 1:**
- **问题陈述**: [清晰地陈述研究问题]
- **创新点与动机**: [解释为什么这个问题是创新的，并结合宏观和微观信息说明研究动机]
- **简要研究思路**: [提出一个初步的研究方法或技术路径]
...

--- 以下是你的分析材料 ---
{source_text}
"""
        brainstorm_results = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_brainstorming_result(brainstorm_results)
        return jsonify({"status": "success", "results": brainstorm_results})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# --- 论文写作 API ---

@app.route('/api/paper/content', methods=['GET'])
def get_paper_content():
    """API: 获取论文的完整内容和状态"""
    content = file_service.get_paper_content()
    return jsonify(content)


@app.route('/api/paper/save', methods=['POST'])
def save_paper_content():
    """API: 保存论文的完整内容和状态"""
    data = request.json
    file_service.save_paper_content(data)
    return jsonify({"status": "success", "message": "内容已保存。"})


@app.route('/api/paper/generate', methods=['POST'])
def generate_paper_section():
    """API: 为论文的特定部分生成或修改内容"""
    data = request.json
    api_key = data.get('apiKey')
    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。"}), 400

    model = data.get('model', 'gemini-2.5-pro')
    temperature = float(data.get('temperature', 1.0))
    language = data.get('language', '中文')  # 新增
    target_section = data.get('target_section')
    paper_data = data.get('paper_data')
    user_prompt = data.get('user_prompt', '')
    is_modification = bool(user_prompt)

    try:
        prompt_parts = [f"你是一位专业的学术论文作者，你的任务是使用{language}撰写或优化论文的一部分。"]

        dependencies = {
            'title': ['idea'], 'abstract': ['idea', 'title'], 'keywords': ['title', 'abstract'],
            'introduction': ['title', 'abstract'], 'background': ['title', 'abstract'],
            'methods': ['title', 'abstract', 'background'],  # 更新依赖
            'results': ['title', 'abstract', 'methods'],
            'discussion': ['title', 'abstract', 'methods', 'results'],
            'conclusion': ['title', 'abstract', 'methods', 'results', 'discussion']
        }
        section_names = {
            'idea': '核心想法', 'title': '标题', 'abstract': '摘要', 'keywords': '关键词',
            'introduction': '引言', 'background': '理论背景与假设建立', 'methods': '研究方法',
            'results': '结果', 'discussion': '讨论', 'conclusion': '结论'
        }

        dep_keys = dependencies.get(target_section, [])
        context_parts = []
        for key in dep_keys:
            if paper_data.get(key, {}).get('content'):
                display_name = section_names.get(key, key.capitalize())
                context_parts.append(f"【{display_name}】:\n{paper_data[key]['content']}")

        if context_parts:
            prompt_parts.append("\n请基于以下背景信息：\n" + "\n\n".join(context_parts))

        display_target_name = section_names.get(target_section, target_section.capitalize())
        if is_modification:
            prompt_parts.append(
                f"\n当前【{display_target_name}】部分的内容如下：\n{paper_data[target_section]['content']}")
            prompt_parts.append(
                f"\n请根据以上所有信息和用户的修改指令，用{language}优化并重写【{display_target_name}】部分。")
            prompt_parts.append(f"\n【用户指令】:\n{user_prompt}")
        else:
            prompt_parts.append(
                f"\n请根据以上背景信息，为论文用{language}撰写【{display_target_name}】部分。请确保内容专业、详尽、逻辑清晰。")

        prompt_parts.append("\n你的回答应仅包含所要求部分的文本内容，不要添加任何额外的标题、标签或解释性文字。")

        final_prompt = "\n".join(prompt_parts)

        generated_content = llm_service.generate_text_from_prompt([final_prompt], model, temperature, api_key)

        return jsonify({"status": "success", "content": generated_content.strip()})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)