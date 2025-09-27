# services/file_service.py
import os
import json
import uuid
import re
from pathlib import Path
from datetime import datetime

# 定义项目中的关键目录
BASE_DIR = Path(__file__).resolve().parent.parent
PAPERS_DIR = BASE_DIR / "papers"
RESULT_DIR = BASE_DIR / "result"
PROMPTS_DIR = BASE_DIR / "prompts"
MARKDOWNS_DIR = RESULT_DIR / "markdowns"
ANALYSES_DIR = RESULT_DIR / "analyses"
REPORTS_DIR = RESULT_DIR / "reports"
BRAINSTORMS_DIR = RESULT_DIR / "brainstorms"
PAPER_WRITING_DIR = RESULT_DIR / "paper_writing"

# 确保所有目录都存在
for dir_path in [
    PAPERS_DIR, RESULT_DIR, PROMPTS_DIR, MARKDOWNS_DIR, ANALYSES_DIR, REPORTS_DIR,
    BRAINSTORMS_DIR, PAPER_WRITING_DIR
]:
    dir_path.mkdir(exist_ok=True)

# 定义文件路径
COMPREHENSIVE_REPORT_PATH = REPORTS_DIR / "Comprehensive_Report.md"
BRAINSTORMING_RESULTS_PATH = BRAINSTORMS_DIR / "Brainstorming_Results.md"
PROMPTS_FILE_PATH = PROMPTS_DIR / "prompts.json"


def load_prompts():
    """从JSON文件加载所有提示词"""
    if not PROMPTS_FILE_PATH.exists():
        raise FileNotFoundError(f"提示词文件未找到: {PROMPTS_FILE_PATH}")
    with open(PROMPTS_FILE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_paper_status_list():
    """获取papers目录下所有PDF文件的状态"""
    pdf_files = [f for f in PAPERS_DIR.glob("*.pdf")]
    status_list = []
    for pdf_path in pdf_files:
        file_name_stem = pdf_path.stem
        markdown_path = MARKDOWNS_DIR / f"{file_name_stem}.md"
        analysis_path = ANALYSES_DIR / f"{file_name_stem}.md"
        status_list.append({
            "filename": pdf_path.name,
            "markdown_exists": markdown_path.exists(),
            "analysis_exists": analysis_path.exists(),
            "processed": markdown_path.exists() and analysis_path.exists()
        })
    return status_list


def save_markdown_result(filename_stem: str, content: str):
    """保存Markdown转换结果"""
    with open(MARKDOWNS_DIR / f"{filename_stem}.md", "w", encoding="utf-8") as f:
        f.write(content)


def save_analysis_result(filename_stem: str, content: str):
    """保存单篇分析结果"""
    with open(ANALYSES_DIR / f"{filename_stem}.md", "w", encoding="utf-8") as f:
        f.write(content)


def get_analyzed_papers():
    """获取所有已分析的文章列表"""
    return [f.stem for f in ANALYSES_DIR.glob("*.md")]


def get_combined_analysis_text(filenames_stems: list):
    """读取并合并多个分析文件的内容"""
    combined_text = ""
    for stem in filenames_stems:
        file_path = ANALYSES_DIR / f"{stem}.md"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                combined_text += f"--- 分析文档: {stem} ---\n\n{content}\n\n"
    return combined_text


def save_comprehensive_report(content: str):
    """保存综合分析报告"""
    with open(COMPREHENSIVE_REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def get_comprehensive_report_content():
    """获取综合分析报告内容"""
    if not COMPREHENSIVE_REPORT_PATH.exists():
        return ""
    with open(COMPREHENSIVE_REPORT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def get_brainstorming_source_text():
    """为头脑风暴准备数据源"""
    report_content = get_comprehensive_report_content()
    if not report_content:
        return None, "综合分析报告尚未生成，无法进行头脑风暴。"

    all_analyses_text = get_combined_analysis_text(get_analyzed_papers())
    combined_source = (
        f"--- 综合分析报告 (宏观视角) ---\n\n{report_content}\n\n"
        f"--- 各单篇文献分析详情 (微观细节) ---\n\n{all_analyses_text}"
    )
    return combined_source, None


def save_brainstorming_result(content: str):
    """保存头脑风暴结果"""
    with open(BRAINSTORMING_RESULTS_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def get_brainstorming_result_content():
    """获取头脑风暴结果内容"""
    if not BRAINSTORMING_RESULTS_PATH.exists():
        return None
    with open(BRAINSTORMING_RESULTS_PATH, "r", encoding="utf-8") as f:
        return f.read()


# --- 论文写作相关文件服务 ---

def get_default_paper_structure():
    """返回一个空的论文结构字典，用于初始化新论文"""
    return {
        "idea": {"content": "", "status": "empty"}, "title": {"content": "", "status": "locked"},
        "abstract": {"content": "", "status": "locked"}, "keywords": {"content": "", "status": "locked"},
        "introduction": {"content": "", "status": "locked"}, "background": {"content": "", "status": "locked"},
        "methods": {"content": "", "status": "locked"}, "results": {"content": "", "status": "locked"},
        "discussion": {"content": "", "status": "locked"}, "conclusion": {"content": "", "status": "locked"},
    }


def list_papers():
    """列出所有论文，使用文件名作为唯一标识和名称"""
    papers_meta = []
    for paper_file in PAPER_WRITING_DIR.glob("*.json"):
        # 论文的 ID 和 documentName 均直接来源于文件名（不含扩展名）
        paper_name = paper_file.stem
        papers_meta.append({
            "id": paper_name,
            "documentName": paper_name
        })
    # 按名称字母顺序排序
    return sorted(papers_meta, key=lambda p: p["documentName"])


def create_new_paper():
    """创建一篇新论文，确保文件名唯一，并返回其元数据"""
    base_name = "未命名论文"
    i = 1
    # 循环查找一个不存在的文件名
    while (PAPER_WRITING_DIR / f"{base_name} {i}.json").exists():
        i += 1

    document_name = f"{base_name} {i}"

    new_paper_data = get_default_paper_structure()
    new_paper_data['id'] = document_name
    new_paper_data['documentName'] = document_name

    save_paper_content(document_name, new_paper_data)

    return {"id": document_name, "documentName": document_name}


def get_paper_content(paper_name: str):
    """根据论文名称（文件名）读取其JSON内容"""
    paper_path = PAPER_WRITING_DIR / f"{paper_name}.json"
    if not paper_path.exists():
        # 如果请求的论文不存在（例如首次启动），则创建一个新的
        if not list_papers():
            new_paper = create_new_paper()
            return get_paper_content(new_paper['id'])
        return None

    try:
        with open(paper_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        # 如果文件损坏，返回默认结构以防止前端崩溃
        return get_default_paper_structure()


def save_paper_content(paper_name: str, data: dict):
    """将论文内容写入指定名称的JSON文件"""
    # 确保存储在JSON内部的名称与文件名一致
    data['documentName'] = paper_name
    data['id'] = paper_name

    paper_path = PAPER_WRITING_DIR / f"{paper_name}.json"
    with open(paper_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def delete_paper(paper_name: str):
    """根据论文名称删除对应的JSON文件"""
    paper_path = PAPER_WRITING_DIR / f"{paper_name}.json"
    if paper_path.exists():
        paper_path.unlink()
        return True
    return False


def rename_paper(old_name: str, new_name: str):
    """重命名论文，包括物理文件名和文件内部的元数据"""
    # 校验新文件名，移除不安全的字符
    safe_new_name = re.sub(r'[\\/*?:"<>|]', "", new_name).strip()
    if not safe_new_name:
        return False, "新名称无效"

    old_path = PAPER_WRITING_DIR / f"{old_name}.json"
    new_path = PAPER_WRITING_DIR / f"{safe_new_name}.json"

    if not old_path.exists():
        return False, "原始论文未找到"

    if old_name == safe_new_name:
        return True, "名称未改变"

    if new_path.exists():
        return False, "已存在同名论文，请使用其他名称"

    try:
        # 读取旧文件内容
        with open(old_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 更新内部名称和ID以匹配新文件名
        data['documentName'] = safe_new_name
        data['id'] = safe_new_name

        # 将更新后的内容写入新文件
        with open(new_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        # 删除旧文件
        old_path.unlink()

        return True, "重命名成功"
    except (IOError, json.JSONDecodeError) as e:
        return False, f"处理文件时出错: {e}"