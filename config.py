# config.py

"""
应用配置文件
用于存放全局常量和可配置选项，方便统一管理和维护。
"""

# 定义应用中所有可选的大语言模型名称列表。
# 列表中的第一个模型将作为前端的默认选项。
AVAILABLE_MODELS = [
    "gemini-2.5-pro",
    "gemini-2.5-flash-preview-09-2025",
    "gemini-2.5-flash",
]

# 定义论文的结构、顺序、依赖关系和显示名称。
# 这是配置的核心，前端和后端都将从此获取结构信息。
# - key: 该部分的唯一标识符。
# - name: 在界面上显示的名称。
# - dependencies: 生成此部分所需的前置部分 'key' 列表。
# - numbered: 布尔值，指示此部分是否应自动编号。
PAPER_STRUCTURE = [
    {'key': 'idea', 'name': '核心想法', 'dependencies': [], 'numbered': False},
    {'key': 'title', 'name': '标题', 'dependencies': ['idea'], 'numbered': False},
    {'key': 'abstract', 'name': '摘要', 'dependencies': ['idea', 'title'], 'numbered': False},
    {'key': 'keywords', 'name': '关键词', 'dependencies': ['idea', 'title', 'abstract'], 'numbered': False},
    {'key': 'introduction', 'name': '引言', 'dependencies': ['idea', 'title', 'abstract'], 'numbered': True},
    {'key': 'background', 'name': '理论背景与假设建立', 'dependencies': ['idea', 'title', 'abstract'], 'numbered': True},
    {'key': 'methods', 'name': '研究方法', 'dependencies': ['idea', 'title', 'abstract', 'background'], 'numbered': True},
    {'key': 'results', 'name': '结果', 'dependencies': ['title', 'abstract', 'methods'], 'numbered': True},
    {'key': 'discussion', 'name': '讨论', 'dependencies': ['title', 'abstract', 'methods', 'results'], 'numbered': True},
    {'key': 'conclusion', 'name': '结论', 'dependencies': ['title', 'abstract', 'methods', 'results', 'discussion'], 'numbered': True},
]

# 为了方便在后端快速按key查找，创建一个字典映射版本
PAPER_STRUCTURE_MAP = {section['key']: section for section in PAPER_STRUCTURE}