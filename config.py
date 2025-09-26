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