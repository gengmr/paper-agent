# app.py
from flask import Flask, render_template, request, jsonify
from pathlib import Path

# 导入我们的服务模块
from services import file_service, llm_service

app = Flask(__name__)

# 在应用启动时加载一次所有提示词
PROMPTS = file_service.load_prompts()


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

    model = data.get('model', 'gemini-1.5-flash')
    temperature_markdown = float(data.get('temperature_markdown', 0.0))
    temperature_analysis = float(data.get('temperature_analysis', 1.0))

    try:
        file_stem = Path(filename).stem
        file_path = file_service.PAPERS_DIR / filename

        if not file_path.exists():
            return jsonify({"status": "error", "message": f"文件 {filename} 未在服务器上找到。"}), 404

        markdown_path = file_service.MARKDOWNS_DIR / f"{file_stem}.md"
        if not markdown_path.exists():
            prompt_markdown = PROMPTS['single_analysis_markdown']
            markdown_content = llm_service.analyze_pdf_content(file_path, prompt_markdown, model, temperature_markdown,
                                                               api_key)
            file_service.save_markdown_result(file_stem, markdown_content)

        analysis_path = file_service.ANALYSES_DIR / f"{file_stem}.md"
        if not analysis_path.exists():
            prompt_analysis = PROMPTS['single_analysis_report']
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

    model = data.get('model', 'gemini-1.5-pro')
    temperature = float(data.get('temperature', 1.0))
    selected_papers = data.get('papers', [])

    if not selected_papers:
        return jsonify({"status": "error", "message": "请至少选择一篇文献进行分析。"}), 400

    try:
        combined_text = file_service.get_combined_analysis_text(selected_papers)
        if not combined_text:
            return jsonify({"status": "error", "message": "未能读取所选文献的分析内容。"}), 500

        prompt = PROMPTS['comprehensive_analysis'].format(combined_text=combined_text)
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

    model = data.get('model', 'gemini-1.5-pro')
    temperature = float(data.get('temperature', 1.0))
    existing_results = data.get('existing_results')
    modification_prompt = data.get('modification_prompt')

    try:
        if modification_prompt and existing_results:
            prompt = PROMPTS['brainstorming_modify'].format(
                existing_results=existing_results,
                modification_prompt=modification_prompt
            )
        else:
            source_text, error_message = file_service.get_brainstorming_source_text()
            if error_message:
                return jsonify({"status": "error", "message": error_message}), 404
            prompt = PROMPTS['brainstorming_generate'].format(source_text=source_text)

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

    model = data.get('model', 'gemini-1.5-pro')
    temperature = float(data.get('temperature', 1.0))
    language = data.get('language', '中文')
    target_section = data.get('target_section')
    paper_data = data.get('paper_data')
    user_prompt = data.get('user_prompt', '')
    is_modification = bool(user_prompt)

    try:
        prompt_parts = [PROMPTS['paper_section_base'].format(language=language)]

        dependencies = {
            'title': ['idea'], 'abstract': ['idea', 'title'], 'keywords': ['title', 'abstract'],
            'introduction': ['title', 'abstract'], 'background': ['title', 'abstract'],
            'methods': ['title', 'abstract', 'background'],
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
            context_string = "\n\n".join(context_parts)
            prompt_parts.append(PROMPTS['paper_section_context_header'].format(context_string=context_string))

        display_target_name = section_names.get(target_section, target_section.capitalize())
        if is_modification:
            prompt_parts.append(PROMPTS['paper_section_instruction_modify'].format(
                target_name=display_target_name,
                current_content=paper_data[target_section]['content'],
                language=language,
                user_prompt=user_prompt
            ))
        else:
            prompt_parts.append(PROMPTS['paper_section_instruction_generate'].format(
                language=language,
                target_name=display_target_name
            ))

        prompt_parts.append(PROMPTS['paper_section_output_format'])

        final_prompt = "\n".join(prompt_parts)

        generated_content = llm_service.generate_text_from_prompt([final_prompt], model, temperature, api_key)

        return jsonify({"status": "success", "content": generated_content.strip()})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)