# app.py
from flask import Flask, render_template, request, jsonify, Response
from pathlib import Path
import traceback
from urllib.parse import quote

# 导入我们的服务模块和配置
from services import file_service, llm_service
from services.export_service import create_markdown_from_paper
# 导入模型列表和新的论文结构配置
from config import AVAILABLE_MODELS, PAPER_STRUCTURE, PAPER_STRUCTURE_MAP

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
    api_key = data.get('apiKey')
    filename = data.get('filename')
    model = data.get('model')
    temperature_markdown_str = data.get('temperature_markdown')
    temperature_analysis_str = data.get('temperature_analysis')

    # 参数校验
    required_params = {
        'apiKey': api_key, 'filename': filename, 'model': model,
        'temperature_markdown': temperature_markdown_str, 'temperature_analysis': temperature_analysis_str
    }
    for param, value in required_params.items():
        if value is None:
            return jsonify({"status": "error", "message": f"请求体中必须提供 '{param}' 参数。"}), 400

    try:
        # 文件处理逻辑
        temperature_markdown = float(temperature_markdown_str)
        temperature_analysis = float(temperature_analysis_str)
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
    api_key, model, temperature_str, selected_papers = data.get('apiKey'), data.get('model'), data.get(
        'temperature'), data.get('papers', [])
    if not api_key: return jsonify({"status": "error", "message": "API Key 缺失。"}), 400
    if not model: return jsonify({"status": "error", "message": "必须提供 'model' 参数。"}), 400
    if temperature_str is None: return jsonify({"status": "error", "message": "必须提供 'temperature' 参数。"}), 400
    if not selected_papers: return jsonify({"status": "error", "message": "请至少选择一篇文献进行分析。"}), 400
    try:
        temperature = float(temperature_str)
        combined_text = file_service.get_combined_analysis_text(selected_papers)
        if not combined_text: return jsonify({"status": "error", "message": "未能读取所选文献的分析内容。"}), 500
        prompt = PROMPTS['comprehensive_analysis'].format(combined_text=combined_text)
        report_content = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_comprehensive_report(report_content)
        return jsonify({"status": "success", "message": "综合分析报告 'Comprehensive_Report.md' 已生成/更新。",
                        "report": report_content})
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
    api_key, model, temperature_str, existing_results, modification_prompt = data.get('apiKey'), data.get(
        'model'), data.get('temperature'), data.get('existing_results'), data.get('modification_prompt')
    if not api_key: return jsonify({"status": "error", "message": "API Key 缺失。"}), 400
    if not model: return jsonify({"status": "error", "message": "必须提供 'model' 参数。"}), 400
    if temperature_str is None: return jsonify({"status": "error", "message": "必须提供 'temperature' 参数。"}), 400
    try:
        temperature = float(temperature_str)
        if modification_prompt and existing_results:
            prompt = PROMPTS['brainstorming_modify'].format(existing_results=existing_results,
                                                            modification_prompt=modification_prompt)
        else:
            source_text, error_message = file_service.get_brainstorming_source_text()
            if error_message: return jsonify({"status": "error", "message": error_message}), 404
            prompt = PROMPTS['brainstorming_generate'].format(source_text=source_text)
        brainstorm_results = llm_service.generate_text_from_prompt([prompt], model, temperature, api_key)
        file_service.save_brainstorming_result(brainstorm_results)
        return jsonify({"status": "success", "results": brainstorm_results})
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# --- 论文写作 API ---

@app.route('/api/paper/structure', methods=['GET'])
def get_paper_structure():
    """API: 获取在 config.py 中定义的论文结构配置。"""
    return jsonify(PAPER_STRUCTURE)


@app.route('/api/papers/list', methods=['GET'])
def list_writing_papers():
    """API: 获取所有可编辑论文的列表。"""
    try:
        papers = file_service.list_papers()
        return jsonify(papers)
    except Exception as e:
        return jsonify({"status": "error", "message": f"无法列出论文: {e}"}), 500


@app.route('/api/paper/content/<paper_name>', methods=['GET'])
def get_paper_content(paper_name):
    """API: 获取指定名称论文的完整内容JSON对象。"""
    try:
        content = file_service.get_paper_content(paper_name)
        if content is None:
            return jsonify({"status": "error", "message": "论文未找到"}), 404
        return jsonify(content)
    except Exception as e:
        return jsonify({"status": "error", "message": f"无法获取论文内容: {e}"}), 500


@app.route('/api/paper/save/<paper_name>', methods=['POST'])
def save_paper_content(paper_name):
    """API: 保存指定名称论文的完整内容JSON对象。"""
    try:
        data = request.json
        file_service.save_paper_content(paper_name, data)
        return jsonify({"status": "success", "message": "内容已保存。"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"保存失败: {e}"}), 500


@app.route('/api/papers/new', methods=['POST'])
def create_new_paper():
    """API: 创建一篇新论文。"""
    try:
        new_paper_meta = file_service.create_new_paper()
        return jsonify({"status": "success", "paper": new_paper_meta})
    except Exception as e:
        # 打印详细错误到服务器控制台，方便调试
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"创建新论文失败: {e}"}), 500


@app.route('/api/papers/delete/<paper_name>', methods=['DELETE'])
def delete_paper(paper_name):
    """API: 删除一篇论文。"""
    try:
        if file_service.delete_paper(paper_name):
            return jsonify({"status": "success", "message": "论文已删除。"})
        return jsonify({"status": "error", "message": "论文未找到或删除失败。"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"删除失败: {e}"}), 500


@app.route('/api/papers/rename/<old_paper_name>', methods=['POST'])
def rename_paper(old_paper_name):
    """API: 重命名一篇论文，这将改变其文件名。"""
    data = request.json
    new_name = data.get('newName')
    if not new_name:
        return jsonify({"status": "error", "message": "必须提供新名称。"}), 400
    try:
        success, message = file_service.rename_paper(old_paper_name, new_name)
        if success:
            return jsonify({"status": "success", "message": message})
        else:
            # 根据 file_service 返回的具体错误信息设置状态码
            status_code = 409 if "已存在同名论文" in message else 500
            return jsonify({"status": "error", "message": message}), status_code
    except Exception as e:
        return jsonify({"status": "error", "message": f"重命名时发生未知错误: {e}"}), 500


@app.route('/api/paper/generate', methods=['POST'])
def generate_paper_section():
    """
    API: 为论文的特定部分生成或修改内容。
    现在完全由 config.py驱动，支持动态的依赖关系和章节名称。
    """
    data = request.json
    api_key, model, temperature_str, language, target_section, paper_data, action_type = \
        data.get('apiKey'), data.get('model'), data.get('temperature'), data.get('language'), \
            data.get('target_section'), data.get('paper_data'), data.get('action_type')

    required_params = {'apiKey': api_key, 'model': model, 'temperature': temperature_str, 'language': language,
                       'target_section': target_section, 'paper_data': paper_data, 'action_type': action_type}
    for param, value in required_params.items():
        if value is None: return jsonify({"status": "error", "message": f"请求体中必须提供 '{param}' 参数。"}), 400

    user_prompt = data.get('user_prompt', '')
    try:
        temperature = float(temperature_str)
        prompt_parts = [PROMPTS['paper_section_base'].format(language=language)]

        target_section_config = PAPER_STRUCTURE_MAP.get(target_section)
        if not target_section_config:
            return jsonify({"status": "error", "message": f"未知的论文部分: {target_section}"}), 400

        dep_keys = target_section_config.get('dependencies', [])
        context_parts = []
        for key in dep_keys:
            if paper_data.get(key, {}).get('content'):
                dep_section_config = PAPER_STRUCTURE_MAP.get(key)
                display_name = dep_section_config['name'] if dep_section_config else key.capitalize()
                context_parts.append(f"【{display_name}】:\n{paper_data[key]['content']}")

        if context_parts:
            context_string = "\n\n".join(context_parts)
            prompt_parts.append(PROMPTS['paper_section_context_header'].format(context_string=context_string))

        display_target_name = target_section_config['name']
        action_map = {'generate': 'paper_section_instruction_generate',
                      'modify': 'paper_section_instruction_modify',
                      'ai_annotate': 'paper_section_instruction_ai_annotate',
                      'modify_annotated': 'paper_section_instruction_modify_annotated',
                      'expand': 'paper_section_instruction_expand',
                      'polish': 'paper_section_instruction_polish'}
        prompt_key = action_map.get(action_type)
        if not prompt_key: return jsonify({"status": "error", "message": f"无效的 action_type: {action_type}"}), 400

        prompt_template = PROMPTS[prompt_key]
        current_content = paper_data.get(target_section, {}).get('content', '')

        if action_type == 'generate':
            instruction = prompt_template.format(language=language, target_name=display_target_name)
        elif action_type == 'modify':
            instruction = prompt_template.format(target_name=display_target_name,
                                                 current_content=current_content,
                                                 language=language, user_prompt=user_prompt)
        elif action_type in ['modify_annotated', 'ai_annotate']:
            instruction = prompt_template.format(target_name=display_target_name,
                                                 current_content=current_content,
                                                 language=language)
        else:  # expand, polish
            instruction = prompt_template.format(target_name=display_target_name,
                                                 current_content=current_content,
                                                 language=language)

        prompt_parts.append(instruction)
        prompt_parts.append(PROMPTS['paper_section_output_format'])
        final_prompt = "\n".join(prompt_parts)
        generated_content = llm_service.generate_text_from_prompt([final_prompt], model, temperature, api_key)
        return jsonify({"status": "success", "content": generated_content.strip()})
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Temperature 参数必须是有效的数字。"}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/paper/export/markdown/<paper_name>', methods=['GET'])
def export_paper_as_markdown(paper_name):
    """
    API: 将指定论文导出为格式化的 Markdown 文件。
    此端点会触发浏览器下载文件。
    """
    try:
        paper_content = file_service.get_paper_content(paper_name)
        if paper_content is None:
            return jsonify({"status": "error", "message": "论文未找到"}), 404

        # 调用新的导出服务来生成 Markdown 文本
        markdown_text = create_markdown_from_paper(paper_content, PAPER_STRUCTURE)

        # 对包含非 ASCII 字符的文件名进行 URL 编码，以符合 RFC 5987 标准
        encoded_filename = quote(f"{paper_name}.md")

        # 创建一个 Flask Response 对象，设置正确的 MIME 类型和 Content-Disposition 头
        # 这会告诉浏览器将响应内容作为文件下载，而不是直接显示
        # filename* 参数用于处理非 ASCII 字符，确保中文名能正确显示
        return Response(
            markdown_text,
            mimetype='text/markdown; charset=utf-8',
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"导出失败: {e}"}), 500


if __name__ == '__main__':
    file_service.PAPERS_DIR.mkdir(exist_ok=True)
    file_service.RESULT_DIR.mkdir(exist_ok=True)
    app.run(debug=True, port=5001)