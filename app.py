# app.py
from flask import Flask, render_template, request, jsonify
from pathlib import Path

# 导入我们的服务模块和配置
from services import file_service, llm_service
from config import AVAILABLE_MODELS  # 导入模型列表

app = Flask(__name__)

# 在应用启动时加载一次所有提示词
PROMPTS = file_service.load_prompts()


@app.context_processor
def inject_models():
    """
    上下文处理器，将可用模型列表注入到所有模板的上下文中。
    这使得在任何HTML模板中都可以直接访问 'models' 变量，无需在每个render_template中手动传递。
    """
    return dict(models=AVAILABLE_MODELS)


# --- 页面路由 ---

@app.route('/')
def index():
    """渲染首页"""
    return render_template('index.html')


@app.route('/<page_name>')
def page(page_name):
    """
    动态渲染指定的功能页面。

    Args:
        page_name (str): URL路径中的页面名称。

    Returns:
        渲染后的HTML页面或首页。
    """
    template_map = {
        "single_literature_analysis": "single_literature_analysis.html",
        "comprehensive_literature_analysis": "comprehensive_literature_analysis.html",
        "brainstorming": "brainstorming.html",
        "paper_writing": "paper_writing.html",
    }
    template_file = template_map.get(page_name)
    if template_file:
        return render_template(template_file)
    # 如果找不到匹配的页面，则默认返回首页
    return render_template('index.html')


# --- API 路由 ---

@app.route('/api/papers', methods=['GET'])
def get_papers():
    """API: 获取 'papers' 目录下所有PDF文件及其处理状态。"""
    papers = file_service.get_paper_status_list()
    return jsonify(papers)


@app.route('/api/single_analysis/process_file', methods=['POST'])
def process_single_file():
    """API: 处理单个指定的PDF文件，包括转换为Markdown和生成分析报告。"""
    data = request.json

    # 从请求中获取必要的参数
    api_key = data.get('apiKey')
    filename = data.get('filename')
    model = data.get('model')
    temperature_markdown_str = data.get('temperature_markdown')
    temperature_analysis_str = data.get('temperature_analysis')

    # 验证关键参数是否存在
    required_params = {
        'apiKey': api_key,
        'filename': filename,
        'model': model,
        'temperature_markdown': temperature_markdown_str,
        'temperature_analysis': temperature_analysis_str
    }
    for param, value in required_params.items():
        if value is None:
            return jsonify({"status": "error", "message": f"请求体中必须提供 '{param}' 参数。"}), 400

    try:
        # 转换温度值为浮点数
        temperature_markdown = float(temperature_markdown_str)
        temperature_analysis = float(temperature_analysis_str)

        file_stem = Path(filename).stem
        file_path = file_service.PAPERS_DIR / filename

        if not file_path.exists():
            return jsonify({"status": "error", "message": f"文件 {filename} 未在服务器上找到。"}), 404

        # 步骤1: 如果Markdown文件不存在，则进行转换
        markdown_path = file_service.MARKDOWNS_DIR / f"{file_stem}.md"
        if not markdown_path.exists():
            prompt_markdown = PROMPTS['single_analysis_markdown']
            markdown_content = llm_service.analyze_pdf_content(
                file_path, prompt_markdown, model, temperature_markdown, api_key
            )
            file_service.save_markdown_result(file_stem, markdown_content)

        # 步骤2: 如果分析报告不存在，则进行分析
        analysis_path = file_service.ANALYSES_DIR / f"{file_stem}.md"
        if not analysis_path.exists():
            prompt_analysis = PROMPTS['single_analysis_report']
            analysis_content = llm_service.analyze_pdf_content(
                file_path, prompt_analysis, model, temperature_analysis, api_key
            )
            file_service.save_analysis_result(file_stem, analysis_content)

        return jsonify({"status": "success", "message": f"文件 {filename} 处理成功。"})

    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/analyzed_papers', methods=['GET'])
def get_analyzed_papers_api():
    """API: 获取所有已成功生成分析报告的文献列表。"""
    papers = file_service.get_analyzed_papers()
    return jsonify(papers)


@app.route('/api/comprehensive_report', methods=['GET'])
def get_comprehensive_report():
    """API: 获取已存在的综合文献综述报告的内容。"""
    content = file_service.get_comprehensive_report_content()
    return jsonify({"content": content})


@app.route('/api/comprehensive_analysis/start', methods=['POST'])
def start_comprehensive_analysis():
    """API: 启动综合文献分析，生成并覆盖保存综述报告。"""
    data = request.json

    # 获取并校验参数
    api_key = data.get('apiKey')
    model = data.get('model')
    temperature_str = data.get('temperature')
    selected_papers = data.get('papers', [])

    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。"}), 400
    if not model:
        return jsonify({"status": "error", "message": "必须提供 'model' 参数。"}), 400
    if temperature_str is None:
        return jsonify({"status": "error", "message": "必须提供 'temperature' 参数。"}), 400
    if not selected_papers:
        return jsonify({"status": "error", "message": "请至少选择一篇文献进行分析。"}), 400

    try:
        temperature = float(temperature_str)
        combined_text = file_service.get_combined_analysis_text(selected_papers)
        if not combined_text:
            return jsonify({"status": "error", "message": "未能读取所选文献的分析内容。"}), 500

        # 格式化提示词并调用LLM服务
        prompt = PROMPTS['comprehensive_analysis'].format(combined_text=combined_text)
        report_content = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_comprehensive_report(report_content)

        return jsonify({
            "status": "success",
            "message": "综合分析报告 'Comprehensive_Report.md' 已生成/更新。",
            "report": report_content
        })
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/brainstorming/result', methods=['GET'])
def get_brainstorming_result():
    """API: 获取已有的头脑风暴结果内容。"""
    content = file_service.get_brainstorming_result_content()
    return jsonify({"content": content})


@app.route('/api/brainstorming/start', methods=['POST'])
def start_brainstorming():
    """API: 基于文献分析进行头脑风暴，支持初次生成和后续修改。"""
    data = request.json

    # 获取并校验参数
    api_key = data.get('apiKey')
    model = data.get('model')
    temperature_str = data.get('temperature')
    existing_results = data.get('existing_results')
    modification_prompt = data.get('modification_prompt')

    if not api_key:
        return jsonify({"status": "error", "message": "API Key 缺失。"}), 400
    if not model:
        return jsonify({"status": "error", "message": "必须提供 'model' 参数。"}), 400
    if temperature_str is None:
        return jsonify({"status": "error", "message": "必须提供 'temperature' 参数。"}), 400

    try:
        temperature = float(temperature_str)

        # 根据是否存在修改指令，选择不同的提示词模板
        if modification_prompt and existing_results:
            # 迭代修改逻辑
            prompt = PROMPTS['brainstorming_modify'].format(
                existing_results=existing_results,
                modification_prompt=modification_prompt
            )
        else:
            # 初次生成逻辑
            source_text, error_message = file_service.get_brainstorming_source_text()
            if error_message:
                return jsonify({"status": "error", "message": error_message}), 404
            prompt = PROMPTS['brainstorming_generate'].format(source_text=source_text)

        # 调用LLM服务并保存结果
        brainstorm_results = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_brainstorming_result(brainstorm_results)

        return jsonify({"status": "success", "results": brainstorm_results})
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# --- 论文写作 API ---

@app.route('/api/paper/content', methods=['GET'])
def get_paper_content():
    """API: 获取论文的完整内容JSON对象。"""
    content = file_service.get_paper_content()
    return jsonify(content)


@app.route('/api/paper/save', methods=['POST'])
def save_paper_content():
    """API: 保存论文的完整内容JSON对象。"""
    data = request.json
    file_service.save_paper_content(data)
    return jsonify({"status": "success", "message": "内容已保存。"})


@app.route('/api/paper/generate', methods=['POST'])
def generate_paper_section():
    """API: 为论文的特定部分生成或修改内容。"""
    data = request.json

    # 获取并校验参数
    api_key = data.get('apiKey')
    model = data.get('model')
    temperature_str = data.get('temperature')
    language = data.get('language')
    target_section = data.get('target_section')
    paper_data = data.get('paper_data')

    required_params = {
        'apiKey': api_key, 'model': model, 'temperature': temperature_str,
        'language': language, 'target_section': target_section, 'paper_data': paper_data
    }
    for param, value in required_params.items():
        if value is None:
            return jsonify({"status": "error", "message": f"请求体中必须提供 '{param}' 参数。"}), 400

    user_prompt = data.get('user_prompt', '')
    is_modification = bool(user_prompt)

    try:
        temperature = float(temperature_str)

        # 构建提示词的基础部分
        prompt_parts = [PROMPTS['paper_section_base'].format(language=language)]

        # 定义章节依赖关系和显示名称
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

        # 动态构建上下文信息
        dep_keys = dependencies.get(target_section, [])
        context_parts = []
        for key in dep_keys:
            if paper_data.get(key, {}).get('content'):
                display_name = section_names.get(key, key.capitalize())
                context_parts.append(f"【{display_name}】:\n{paper_data[key]['content']}")

        if context_parts:
            context_string = "\n\n".join(context_parts)
            prompt_parts.append(PROMPTS['paper_section_context_header'].format(context_string=context_string))

        # 根据是“生成”还是“修改”来构建指令部分
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

        # 添加输出格式要求
        prompt_parts.append(PROMPTS['paper_section_output_format'])
        final_prompt = "\n".join(prompt_parts)

        # 调用LLM服务
        generated_content = llm_service.generate_text_from_prompt([final_prompt], model, temperature, api_key)

        return jsonify({"status": "success", "content": generated_content.strip()})

    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    # 确保在启动前所有必要的目录都已创建
    file_service.PAPERS_DIR.mkdir(exist_ok=True)
    file_service.RESULT_DIR.mkdir(exist_ok=True)
    app.run(debug=True, port=5001)