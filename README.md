# 论文写作智能体 (AI-Powered Academic Writing Assistant)

**论文写作智能体**是一个全流程、智能化的学术研究与论文写作辅助工具。它利用先进的大语言模型（LLM）能力，将繁琐的学术工作流（从文献分析到论文成稿）整合成一个连贯、高效、自动化的操作平台。

本项目的核心设计理念是将复杂的学术研究过程拆解为一系列相互关联、循序渐进的模块化任务，并通过精心设计的用户界面和强大的后端服务，引导用户以结构化的方式完成高质量的学术产出。

## 核心功能

本项目提供了一个从研究构想到最终成文的完整工作流，主要包含四大核心模块：

1.  **单篇文献深度分析 (`Single Literature Analysis`)**:
    *   自动处理用户上传的PDF格式学术论文。
    *   将PDF内容完整转换为结构化的Markdown文本，保留原始章节和格式。
    *   调用大语言模型，对单篇论文生成专业、深入的学术分析报告，涵盖核心问题、创新点、研究方法、结论和潜在不足等方面。

2.  **多文献综合分析 (`Comprehensive Literature Analysis`)**:
    *   允许用户选择多篇已经完成单篇分析的文献。
    *   将各篇文献的分析报告进行整合，并调用大语言模型撰写一份全面、深刻的综合性文献综述。
    *   综述报告自动梳理研究领域的热点、主流方法、学术共识与争议，并敏锐地指出研究空白（Gaps）。

3.  **创新课题头脑风暴 (`Brainstorming`)**:
    *   基于宏观的文献综述报告和微观的单篇分析细节，智能激发具有高度创新性的研究课题。
    *   支持对已生成的课题进行迭代式修改和优化，实现人机协同的深度思考。

4.  **结构化论文写作 (`Paper Writing`)**:
    *   提供一个可视化的论文结构撰写界面，涵盖从核心想法（Idea）到结论（Conclusion）的每一个章节。
    *   各章节的撰写遵循学术逻辑依赖关系，例如，引言（Introduction）的生成会参考已确定的标题（Title）和摘要（Abstract）。
    *   支持对任一章节进行初次生成或根据用户指令进行修改完善，逐步构建完整的论文。

## 项目设计思路与细节

本项目的架构设计遵循**模块化、服务化、状态持久化**和**以提示工程为核心**的设计哲学，旨在构建一个可扩展、易维护且功能强大的智能应用。

### 1. 整体设计哲学

*   **分层服务架构 (Service-Oriented Architecture)**: 项目逻辑被清晰地划分为三个层次：
    *   **表现层 (Presentation Layer)**: 由 `Flask` 路由 (`app.py`)、HTML模板 (`templates/`) 和前端静态资源 (`static/`) 构成，负责用户交互和数据展示。
    *   **服务层 (Service Layer)**: 位于 `services/` 目录，将核心业务逻辑（文件处理、LLM交互）封装成独立的服务模块，与表现层解耦。
    *   **数据与配置层 (Data & Configuration Layer)**: 包括用户上传的文献 (`papers/`)、AI生成的中间与最终结果 (`result/`) 以及定义AI行为的核心提示词 (`prompts/`)。

*   **状态持久化 (Stateful Persistence)**: 用户的每一步操作和AI的每一次输出都被持久化地保存在文件系统中 (`result/` 目录)。这种设计使得研究工作可以随时中断和恢复，所有进度都不会丢失。`paper_content.json` 文件是这一思想的集中体现，它完整记录了论文写作的每一个章节的状态和内容。

*   **渐进式工作流 (Progressive Workflow)**: 四大核心功能并非孤立，而是构成了一个逻辑严谨的学术研究漏斗。从广泛的单篇文献输入，到提炼为综合综述，再聚焦于创新想法，最终收敛至一篇完整的论文。这种流程设计符合真实世界的科研规律，并体现在API的依赖关系上（例如，头脑风暴依赖于综合分析报告）。

*   **提示工程为核心 (Prompt-Centric Design)**: 本项目的“智能”并非硬编码在Python代码中，而是由 `prompts/prompts.json` 文件中的高质量提示词（Prompts）驱动。我们将提示词视为一种“软代码”，它定义了AI的角色、任务、输出格式和思维链。这种设计使得我们可以通过修改JSON文件，快速迭代和优化AI的行为，而无需改动后端逻辑。

### 2. 项目结构详解

```
.
├── app.py                  # Flask应用主文件，负责路由和API端点
├── papers/                 # 用户存放待分析的PDF文献
├── prompts/
│   └── prompts.json        # 核心：定义所有与LLM交互的提示词
├── result/                 # 存放所有AI生成的结果
│   ├── analyses/           # 存放单篇文献的深度分析报告.md文件
│   ├── brainstorms/        # 存放头脑风暴结果.md文件
│   ├── markdowns/          # 存放PDF转换后的.md原文
│   ├── paper_writing/      # 存放论文写作状态的.json文件
│   └── reports/            # 存放综合文献综述报告.md文件
├── services/               # 核心业务逻辑服务
│   ├── __init__.py
│   ├── file_service.py     # 封装所有文件系统操作
│   └── llm_service.py      # 封装所有与Google Gemini API的交互
├── static/                 # 前端静态文件
│   ├── css/style.css
│   └── js/main.js
├── templates/              # Flask HTML模板
│   ├── layout.html         # 基础布局模板
│   ├── index.html          # 首页
│   ├── ... (其他功能页面)
└── README.md               # 本文件
```

### 3. 后端设计 (`app.py` & `services/`)

#### a. `file_service.py` - 文件操作抽象层

该模块是项目的数据持久化核心，它将所有对文件系统的读写操作（如路径管理、文件创建、内容读写）进行统一封装。

*   **职责**:
    1.  **路径管理**: 集中定义所有关键目录（`PAPERS_DIR`, `ANALYSES_DIR`等），确保路径的一致性并自动创建不存在的目录。
    2.  **状态查询**: `get_paper_status_list()` 函数扫描 `papers` 目录，并对照 `result` 目录检查每个文件的处理状态（是否已转为Markdown，是否已生成分析报告），为前端提供状态展示。
    3.  **数据读写**: 提供了一系列原子化的 `save_...` 和 `get_...` 函数，用于安全地读写Markdown、分析报告、JSON等文件，使得上层调用者无需关心具体的文件路径和读写模式。
    4.  **数据聚合**: `get_combined_analysis_text()` 和 `get_brainstorming_source_text()` 体现了其数据处理能力，能够根据业务需求聚合多个文件的内容，为LLM提供完整的上下文。

#### b. `llm_service.py` - LLM交互网关

该模块是与大语言模型API交互的唯一通道，实现了对Google Gemini API的完全封装。

*   **职责**:
    1.  **客户端管理**: `get_client()` 函数根据用户在前端提供的API Key动态创建`genai.Client`实例。这种设计安全且灵活，避免了硬编码密钥。
    2.  **API封装**: 提供了两种核心交互模式的封装：
        *   `analyze_pdf_content()`: 专门处理PDF文件。它严格遵循“上传文件 -> 调用模型 -> 删除文件”的最佳实践，确保了云端资源的及时清理。
        *   `generate_text_from_prompt()`: 用于处理纯文本输入，是项目中绝大多数LLM调用的基础。
    3.  **解耦**: 将AI服务提供商的SDK细节完全隔离在此模块内。如果未来需要切换到其他LLM（如OpenAI），理论上只需修改这一个文件，而无需触及 `app.py` 中的业务逻辑。

#### c. `app.py` - 应用路由与业务流程编排

这是应用的“大脑”，负责接收前端请求，调用服务层处理，并返回结果。

*   **路由设计**:
    *   **页面路由**: 使用动态路由 `@app.route('/<page_name>')` 优雅地处理了多个功能页面的渲染，使得添加新页面非常简单，只需在`template_map`中增加一个映射即可。
    *   **API路由**: 所有以 `/api/` 开头的路由都用于前后端数据交互，实现了彻底的前后端分离。

*   **核心API端点设计细节**:
    *   **`process_single_file`**:
        *   **幂等性设计**: 在处理文件前，会检查目标Markdown和分析文件是否已存在，避免重复处理和不必要的API调用。
        *   **参数化**: 接收前端传递的模型名称和温度（temperature）参数，将用户的选择动态应用于LLM调用。
    *   **`start_comprehensive_analysis`**:
        *   **上下文构建**: 调用 `file_service.get_combined_analysis_text` 来动态构建一个包含所有选定文献分析的、信息丰富的上下文。
        *   **Prompt格式化**: 使用 `.format(combined_text=...)` 将聚合后的文本注入到 `prompts.json` 中定义的模板里，形成最终发送给LLM的完整指令。
    *   **`start_brainstorming`**:
        *   **双模态逻辑**: 通过判断 `modification_prompt` 是否存在，在同一个API端点内实现了“初次生成”和“后续修改”两种不同的业务逻辑，分别对应 `brainstorming_generate` 和 `brainstorming_modify` 两个不同的提示词模板。
    *   **`generate_paper_section`**:
        *   **动态依赖注入**: 这是项目中最复杂的提示工程应用。它首先通过 `dependencies` 字典查询当前目标章节（如“讨论”）所依赖的前置章节（如“方法”、“结果”）。
        *   **上下文自动构建**: 遍历所有依赖项，从 `paper_data` 中提取已完成的内容，并按照 `paper_section_context_header` 提示词模板，自动构建一个结构化的“背景信息”部分。
        *   **指令动态生成**: 根据 `is_modification` 标志，选择是使用“生成指令” (`paper_section_instruction_generate`) 还是“修改指令” (`paper_section_instruction_modify`) 的提示词模板。
        *   **提示词链 (Prompt Chaining)**: 将基础指令、背景信息、具体指令和输出格式要求等多个提示词片段 (`prompt_parts`) 动态拼接成一个逻辑严密、上下文完整的最终提示词，极大地提高了生成内容的相关性和质量。

### 4. 提示工程设计 (`prompts/prompts.json`)

`prompts.json` 是本项目的灵魂，它体现了将自然语言作为编程指令的核心思想。

*   **角色扮演 (Persona)**: 提示词通过 `你是一位顶尖的科研学者` 或 `作为一名顶尖的战略科学家` 等指令，为LLM设定了一个专家角色，这能显著提升生成内容的专业性和风格。
*   **结构化输出指令**: 明确要求输出格式为Markdown，并给出清晰的结构要求（如综述的六个部分、头脑风暴的三个要素），保证了AI输出的规范性和可解析性。
*   **上下文注入**: 大量使用 `{variable_name}` 占位符，使得后端可以将动态数据（如文献内容、用户指令）无缝地注入到提示词模板中。
*   **思维链 (Chain of Thought)**: 在复杂的提示词（如`comprehensive_analysis`）中，指令本身就构成了一个引导LLM逐步思考的逻辑链条，从引言到结论，确保了内容的深度和逻辑性。
*   **零样本与少样本学习**: 许多提示词利用了LLM强大的零样本学习能力，通过清晰的指令直接完成任务。而`paper_section_instruction_modify`则是一个少样本学习的例子，它向LLM同时提供了“当前内容”（示例）和“修改指令”，引导模型进行优化。

### 5. 前端设计 (`static/` & `templates/`)

前端负责提供一个清晰、流畅的用户体验，将复杂的后端工作流可视化。

*   **模块化视图**: 每个核心功能对应一个独立的HTML页面，由 `main.js` 中的 `init...Page()` 函数进行初始化和事件绑定，代码结构清晰。
*   **异步通信**: 所有与后端的交互都通过 `fetch` API 异步进行，避免了页面刷新，提供了如桌面应用般流畅的体验。
*   **动态UI更新**: JavaScript根据API返回的数据动态渲染页面元素（如文件列表、分析报告），并实时更新按钮状态（如禁用、加载中），为用户提供即时反馈。
*   **本地存储**: API Key被安全地存储在浏览器的 `localStorage` 中，用户只需配置一次，方便后续使用。
*   **富文本渲染**: 使用 `marked.js` 库将后端返回的Markdown文本实时渲染为格式丰富的HTML，极大地提升了内容的可读性。

## 安装与运行

### **环境要求**
*   **操作系统**: Windows, macOS, 或 Linux
*   **Conda**: 确保您的系统中已安装 [Anaconda](https://www.anaconda.com/products/distribution) 或 [Miniconda](https://docs.conda.io/en/latest/miniconda.html)。
*   **Git**: 确保您的系统中已安装 [Git](https://git-scm.com/)。

### **步骤一：克隆项目代码**
打开您的终端（Terminal, PowerShell, 或 Command Prompt），并执行以下命令将项目代码克隆到本地：
```bash
git clone <your-repository-url>
cd <project-directory-name>
```

### **步骤二：创建并激活Conda环境**
我们将创建一个名为 `paper_agent` 的独立Conda环境，并指定使用Python 3.10版本，以确保环境的纯净和一致性。
```bash
# 创建一个名为 paper_agent 的新环境，并安装 Python 3.10
conda create -n paper_agent python=3.10 -y

# 激活新创建的环境
conda activate paper_agent
```
成功激活后，您终端的命令提示符前会显示 `(paper_agent)`。

### **步骤三：安装项目依赖**
在已激活的 `paper_agent` 环境中，使用 `pip` 和项目提供的 `requirements.txt` 文件来安装所有必需的Python库。
```bash
pip install -r requirements.txt
```

### **步骤四：准备待分析的文献**
将您需要分析的PDF格式学术论文，复制或移动到项目根目录下的 `papers/` 文件夹中。如果该文件夹不存在，请手动创建。

### **步骤五：启动Web应用服务**
确保您仍在项目的根目录并且 `paper_agent` 环境已激活，然后执行以下命令来启动Flask Web服务器：
```bash
python app.py
```
启动成功后，您将在终端看到类似以下的输出，表明服务器正在运行：
```
 * Running on http://127.0.0.1:5001
Press CTRL+C to quit
```

### **步骤六：访问并配置应用**
1.  **访问应用**: 打开您的网页浏览器（推荐使用Chrome, Firefox, 或 Edge），在地址栏输入 `http://127.0.0.1:5001` 并回车。
2.  **配置API Key**: 首次访问时，应用会跳转到首页。请在 "API Key" 输入框中粘贴您的 Google API Key，然后点击“保存密钥”。密钥会安全地保存在您浏览器的本地存储中，供后续操作使用。

现在，您可以开始使用论文写作智能体的各项功能了。

## 使用流程

1.  **首页与设置**: 首次使用时，在首页输入并保存您的Google API Key。
2.  **单篇文献分析**:
    *   导航至“单篇文献分析”页面。
    *   系统会自动列出 `papers/` 目录下的所有PDF及其处理状态。
    *   点击“开始分析”按钮，系统将自动对所有“待处理”的文献进行Markdown转换和深度分析。
3.  **综合文献分析**:
    *   导航至“综合文献分析”页面。
    *   勾选您希望进行综述的、已完成分析的文献。
    *   点击“生成/更新综述报告”按钮，系统将生成一份`Comprehensive_Report.md`。
4.  **头脑风暴**:
    *   导航至“头脑风暴”页面。
    *   点击“开始头脑风暴”，AI将基于综合报告和单篇分析，提出多个创新研究课题。
    *   在底部的输入框中输入修改指令，对结果进行迭代优化。
5.  **论文写作**:
    *   导航至“论文写作”页面。
    *   从“核心想法”开始，逐步填写或点击“生成”按钮来完成每个章节。
    *   对于已完成的章节，可以使用“修改”功能，或直接在文本框中编辑。系统会自动保存您的进度。