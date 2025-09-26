# services/llm_service.py
import pathlib
from google import genai
from google.genai import types


def get_client(api_key: str):
    """
    根据传入的API Key动态创建并返回一个genai.Client实例。
    严格遵循官方文档的密钥配置方式。
    """
    if not api_key:
        raise ValueError("API Key 不能为空。请在首页配置API Key。")
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        # 捕获可能的初始化错误，例如无效的密钥格式
        raise ConnectionError(f"初始化Google GenAI Client时出错: {e}")


def analyze_pdf_content(file_path: pathlib.Path, prompt: str, model_name: str, temperature: float, api_key: str):
    """
    严格按照官方文档，分析单个PDF文件。
    """
    client = get_client(api_key)  # 动态获取客户端

    # 用于调用谷歌搜索
    grounding_tool = types.Tool(
        google_search=types.GoogleSearch()
    )

    if not file_path.exists():
        raise FileNotFoundError(f"文件未找到: {file_path}")

    print(f"正在上传文件: {file_path.name}...")
    # 1. 上传文件
    uploaded_file = client.files.upload(file=file_path)
    print(f"文件上传成功: {uploaded_file.name}")

    # 2. 调用模型生成内容
    print(f"使用模型 '{model_name}' (temperature={temperature}) 分析文件...")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                tools=[grounding_tool],
                temperature=temperature
            )
        )
        return response.text
    finally:
        # 3. 确保无论成功与否都清理上传的文件
        client.files.delete(name=uploaded_file.name)
        print(f"已清理上传的文件: {uploaded_file.name}")


def generate_text_from_prompt(content_list: list, model_name: str, temperature: float, api_key: str):
    """
    严格按照官方文档，根据文本提示生成内容（单轮对话）。
    """
    client = get_client(api_key)  # 动态获取客户端

    # 用于调用谷歌搜索
    grounding_tool = types.Tool(
        google_search=types.GoogleSearch()
    )

    print(f"使用模型 '{model_name}' (temperature={temperature}) 生成文本...")
    response = client.models.generate_content(
        model=model_name,
        contents=content_list,
        config=types.GenerateContentConfig(
            tools=[grounding_tool],
            temperature=temperature
        )
    )
    return response.text


# 多轮对话API的封装（当前未使用，但按要求备用）
def start_chat_session(model_name: str, api_key: str):
    """
    严格按照官方文档，创建一个多轮对话会话。
    """
    client = get_client(api_key)  # 动态获取客户端

    chat = client.chats.create(model=model_name)
    return chat