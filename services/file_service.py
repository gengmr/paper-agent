# services/file_service.py
import os
import json
from pathlib import Path

# 定义项目中的关键目录
BASE_DIR = Path(__file__).resolve().parent.parent
PAPERS_DIR = BASE_DIR / "papers"
RESULT_DIR = BASE_DIR / "result"
MARKDOWNS_DIR = RESULT_DIR / "markdowns"
ANALYSES_DIR = RESULT_DIR / "analyses"
REPORTS_DIR = RESULT_DIR / "reports"
BRAINSTORMS_DIR = RESULT_DIR / "brainstorms"
# 新增: 论文写作内容目录
PAPER_WRITING_DIR = RESULT_DIR / "paper_writing"

# 确保所有目录都存在
for dir_path in [
    PAPERS_DIR, RESULT_DIR, MARKDOWNS_DIR, ANALYSES_DIR, REPORTS_DIR,
    BRAINSTORMS_DIR, PAPER_WRITING_DIR
]:
    dir_path.mkdir(exist_ok=True)

# 定义唯一的综合报告、头脑风暴和论文内容文件名
COMPREHENSIVE_REPORT_PATH = REPORTS_DIR / "Comprehensive_Report.md"
BRAINSTORMING_RESULTS_PATH = BRAINSTORMS_DIR / "Brainstorming_Results.md"
# 新增: 论文内容JSON文件路径
PAPER_CONTENT_PATH = PAPER_WRITING_DIR / "paper_content.json"


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
    with open(ANALYSES_DIR / f"{file_name_stem}.md", "w", encoding="utf-8") as f:
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
    """保存综合分析报告，文件名固定，直接覆盖"""
    with open(COMPREHENSIVE_REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    return str(COMPREHENSIVE_REPORT_PATH)


def get_comprehensive_report_content():
    """获取唯一的综合分析报告内容"""
    if not COMPREHENSIVE_REPORT_PATH.exists():
        return ""
    with open(COMPREHENSIVE_REPORT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def get_brainstorming_source_text():
    """
    为增强版头脑风暴准备数据源：
    结合综合报告和所有单篇分析的详情。
    """
    report_content = get_comprehensive_report_content()
    if not report_content:
        return None, "综合分析报告尚未生成，无法进行头脑风暴。"

    all_analyses_text = get_combined_analysis_text(get_analyzed_papers())

    # 将两部分内容清晰地组合起来
    combined_source = (
        "--- 综合分析报告 (宏观视角) ---\n\n"
        f"{report_content}\n\n"
        "--- 各单篇文献分析详情 (微观细节) ---\n\n"
        f"{all_analyses_text}"
    )

    return combined_source, None


def save_brainstorming_result(content: str):
    """保存头脑风暴结果，文件名固定，直接覆盖"""
    with open(BRAINSTORMING_RESULTS_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    return str(BRAINSTORMING_RESULTS_PATH)


def get_brainstorming_result_content():
    """获取唯一的头脑风暴结果内容"""
    if not BRAINSTORMING_RESULTS_PATH.exists():
        return None
    with open(BRAINSTORMING_RESULTS_PATH, "r", encoding="utf-8") as f:
        return f.read()


# --- 论文写作相关文件服务 ---

def get_default_paper_structure():
    """返回一个空的论文结构字典，用于初始化"""
    return {
        "idea": {"content": "", "status": "empty"},
        "title": {"content": "", "status": "locked"},
        "abstract": {"content": "", "status": "locked"},
        "keywords": {"content": "", "status": "locked"},
        "introduction": {"content": "", "status": "locked"},
        "background": {"content": "", "status": "locked"},
        "methods": {"content": "", "status": "locked"},
        "results": {"content": "", "status": "locked"},
        "discussion": {"content": "", "status": "locked"},
        "conclusion": {"content": "", "status": "locked"},
    }


def get_paper_content():
    """
    读取 paper_content.json 文件。
    如果文件不存在，则创建并返回一个默认的空结构。
    """
    if not PAPER_CONTENT_PATH.exists():
        default_content = get_default_paper_structure()
        save_paper_content(default_content)
        return default_content

    try:
        with open(PAPER_CONTENT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        # 如果文件损坏或无法读取，返回默认结构
        return get_default_paper_structure()


def save_paper_content(data: dict):
    """将论文内容对象写入 paper_content.json 文件"""
    with open(PAPER_CONTENT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)