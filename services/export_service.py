# services/export_service.py
# -*- coding: utf-8 -*-

"""
Markdown 导出服务
================

本模块提供将平台内部存储的结构化论文数据（JSON格式）转换为
一份格式严谨、符合学术规范的 Markdown 文件的核心功能。

设计哲学：
- **单一职责**: 此模块的唯一目标是进行格式转换，不涉及任何业务逻辑或数据获取。
- **配置驱动**: 转换过程严格遵循 `config.py` 中定义的 `PAPER_STRUCTURE` 列表，
  确保输出的章节顺序和编号规则与平台其他部分保持一致。
- **高可读性**: 生成的 Markdown 文本力求简洁、清晰，并兼容主流的 Markdown 编辑器和渲染器。

主要功能：
- `create_markdown_from_paper`: 接收论文数据和结构配置，生成完整的 Markdown 字符串。
"""
import re
from config import PAPER_STRUCTURE_MAP


def _clean_content(text: str) -> str:
    """
    使用正则表达式移除文本中的自定义批注标记，生成干净的文本。

    此函数的目标是将编辑器中的批注格式（例如，`{{原文}}【修改意见：...】`）
    还原为最终的、不含任何标记的文本（即 `原文`）。

    Args:
        text (str): 可能包含批注标记的原始字符串。

    Returns:
        str: 清理掉所有批注标记后的纯净字符串。
    """
    # 正则表达式解析:
    # - `{{([\s\S]+?)}}`: 这是一个捕获组 (由括号 `()` 定义)。
    #   - `[\s\S]+?`: 非贪婪地匹配一个或多个任意字符（包括空格、换行符等）。
    #   - 这部分会捕获被双大括号包裹的原始文本。
    # - `【修改意见：[\s\S]+?】`: 匹配完整的修改意见部分，但由于没有括号，所以不捕获。
    # `re.sub` 函数会找到所有匹配该模式的子字符串，并用第一个捕获组的内容 (`\1`) 替换整个匹配项。
    pattern = r"{{([\s\S]+?)}}【修改意见：[\s\S]+?】"
    return re.sub(pattern, r'\1', text)


def create_markdown_from_paper(paper_data: dict, paper_structure_list: list) -> str:
    """
    根据论文数据和结构配置，生成一份完整的 Markdown 格式文本。

    此函数会遍历 `paper_structure_list` 来保证章节的正确顺序。
    它会根据每个章节的 `numbered` 属性来决定是否添加数字前缀，
    并使用标准的 Markdown 语法（如 H1、H2 标题）来构建文档。
    在处理每个章节时，它会首先调用 `_clean_content` 函数移除所有批注。

    Args:
        paper_data (dict): 包含论文所有章节内容的字典。
                           键为章节的唯一标识符（如 'title', 'abstract'），
                           值为包含 'content' 字段的字典。
        paper_structure_list (list): 从 `config.py` 导入的 `PAPER_STRUCTURE` 列表，
                                     定义了论文的完整结构和元数据。

    Returns:
        str: 格式化后的完整、干净的 Markdown 文本。
    """
    markdown_parts = []
    numbered_section_counter = 1

    for section_config in paper_structure_list:
        key = section_config['key']
        section_data = paper_data.get(key)

        # 仅当章节存在且内容不为空时才处理
        if section_data and section_data.get('content', '').strip():
            content = section_data['content'].strip()

            # 核心步骤：在添加到文档之前，清理内容中的所有批注信息
            cleaned_content = _clean_content(content)

            # 如果清理后内容为空（例如，整个部分都是一个批注），则跳过此章节
            if not cleaned_content.strip():
                continue

            name = section_config['name']

            # 根据章节类型应用不同的 Markdown 标题级别
            if key == 'title':
                markdown_parts.append(f"# {cleaned_content}")
            elif key in ['abstract', 'keywords']:
                markdown_parts.append(f"## {name}\n\n{cleaned_content}")
            else:
                if section_config.get('numbered', False):
                    # 处理需要编号的章节
                    markdown_parts.append(f"## {numbered_section_counter}. {name}\n\n{cleaned_content}")
                    numbered_section_counter += 1
                else:
                    # 处理不需要编号的章节（例如 '核心想法'）
                    markdown_parts.append(f"## {name}\n\n{cleaned_content}")

            # 在各章节之间添加额外的换行以增强可读性
            markdown_parts.append("\n")

    # 使用两个换行符连接所有部分，形成最终的文档
    return "\n".join(markdown_parts)