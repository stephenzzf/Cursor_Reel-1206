AideaGLO AI Short Video Reel (AI短视频) 模块的详细产品规划与能力白皮书。
该模块被设计为一个**“混合模态无限画板（Hybrid Multimodal Canvas）”**，旨在打破图片与视频生成的界限，专为短视频（Reels/TikTok/Shorts）创作者提供从静态分镜到动态视频的一站式生产环境。
🎬 AideaGLO - AI Short Video Reel 产品规划书 (v1.0)
1. 产品愿景与定位
定位：面向出海 DTC 品牌和内容创作者的 Agentic 混合模态短视频工作台。
核心价值：
混合模态流 (Hybrid Flow)：在一个无限画板上同时处理图片（分镜/关键帧）和视频，实现从静态灵感到动态成片的无缝流转。
品牌一致性 (Brand DNA)：通过 AI 强制约束视觉风格和运镜习惯，确保生成内容符合品牌调性。
Agentic 协作：不仅仅是工具，而是配备了“AI 创意总监”，能够理解模糊指令、检测意图偏差并优化提示词。
2. 核心功能模块 (Core Capabilities)
2.1 🧠 AI 创意总监 (Reel Creative Director)
这是系统的“大脑”，负责理解用户自然语言并调度底层模型。
智能意图识别：自动检测用户输入是想要生成“图片”还是“视频”。
逻辑：分析提示词中的动词（如 "pan", "zoom", "fly over" -> Video）与名词（"poster", "icon" -> Image）。
模型纠偏与建议：当用户选择了图片模型但输入了视频指令（或反之）时，主动发出 MODEL_MISMATCH 警报并建议切换模型。
提示词优化：基于 Brand DNA 对简短的提示词进行扩写，补充光影、材质、物理规律和运镜描述。
设计灵感生成：在生成前提供多种视觉/动态方案（Design Plans），并生成预览图供用户选择。
2.2 🧬 品牌 DNA 引擎 (Brand DNA Engine)
确保内容符合品牌规范的底层约束系统。
视觉基因提取：从上传的 Logo、参考图和视频链接中提取风格。
多维约束参数：
Visual Style：构图、渲染风格（如“极简”、“赛博朋克”）。
Color Palette：品牌核心色板。
Mood：情感氛围（如“宁静”、“高燃”）。
Motion Style（视频独有）：定义运镜节奏（如“Slow pan”、“Drone FPV”、“Fast cut”）。
Negative Constraints：品牌避讳元素（如“拒绝霓虹灯”、“拒绝杂乱背景”）。
自动注入：用户无需每次输入风格词，DNA 引擎会在 Prompt 层面自动注入上述约束。
2.3 🎨 无限混合画板 (Infinite Hybrid Canvas)
一个支持空间整理和非线性创作的交互界面。
混合资产管理：
图片资产：支持生成、上传、重绘、去底、高清放大。
视频资产：支持生成、播放、帧提取。
血缘关系连线 (Connection Lines)：
可视化展示资产之间的派生关系（例如：图片 A -> 视频 B）。
自动连线逻辑：当基于“图片 A”生成“视频 B”时，画板会自动绘制贝塞尔曲线连接两者。
智能对齐与吸附 (Smart Snap)：拖拽素材时自动显示辅助线，帮助用户整理分镜墙。
上下文编辑 (On-Canvas Chat)：
选中任意素材（图或视频），直接在画板上通过对话气泡修改（如“把背景换成红色”、“让动作再快一点”）。
2.4 🛠️ 生成与编辑能力矩阵
能力维度	细分功能	技术实现/模型
文生视频	Text-to-Video	Google Veo (Fast/Gen)
图生视频	Image-to-Video (首帧)	Google Veo + 上传参考图
首尾帧生成	Start/End Frame to Video	Google Veo + 上传两张图
文生图	Text-to-Image (分镜)	Imagen 3 / Gemini Flash Image
图生图	Image-to-Image (风格迁移)	Gemini Pro Vision
视频编辑	帧提取 (Extract Frame)	从视频中截取高清帧转为图片资产
图片编辑	智能抠图 (Remove BG)	Gemini Vision
图片增强	2K/4K 高清放大 (Upscale)	Gemini 3 Pro Vision (重绘放大)
3. 用户工作流 (User Journey)
场景 A：从零开始的创意短片
灵感阶段：用户开启 "Design Inspiration" 模式，输入主题（如“未来感跑鞋广告”）。
方案选择：AI 生成 3 个包含预览图和运镜描述的方案。用户选择“方案 B：悬浮拆解”。
分镜生成：AI 自动切换至 Flash Image 模型，快速生成 4 张关键帧图片。
视频转化：用户选中满意的关键帧，点击“生成视频”，模型自动切换至 Veo Fast 生成 5秒动态预览。
成品输出：用户满意预览后，切换至 Veo Gen 生成高画质视频并下载。
场景 B：基于品牌资产的衍生
激活 DNA：用户在顶部激活 "Nike Style" Brand DNA。
素材上传：用户上传一张产品静态图。
图生视频：用户输入“缓慢旋转展示，光影流动”，AI 结合 DNA 中的 "Cinematic Lighting" 生成视频。
帧提取与修图：用户觉得视频第 3 秒画面很美，点击 "复制画面" 提取为图片，使用 "高清放大" 功能制作成海报。
4. 技术架构概要
4.1 前端 (React + TypeScript)
状态管理：useReelGeneration Hook 集中管理消息流、资产状态（assets）、选中态和工具栏逻辑。
画布渲染：ReelCanvas 组件处理缩放（Zoom）、平移（Pan）、拖拽（Drag）和连线绘制（SVG Bezier）。
交互层：ReelChatSidebar 处理对话流，ReelEditorToolbar 提供上下文感知的操作按钮。
4.2 AI 服务层 (Gemini SDK)
Router：geminiService_reel.ts 负责路由分发。
Video Engine：调用 veo-3.1-fast-generate-preview 或 veo-3.1-generate-preview。
Image Engine：调用 gemini-2.5-flash-image 或 gemini-3-pro-image-preview。
Vision Capabilities：利用 Gemini 的多模态能力进行反推提示词、分析图片风格。
4.3 数据持久化 (Firebase)
Storage：
视频/图片文件存储于 users/{uid}/generated_videos/。
支持 Blob URL 到持久化 Cloud URL 的转换 (persistVideoToStorage)。
Firestore：
gallery 集合存储元数据（Prompt, Model, Aspect Ratio, Creation Time）。
visual_profiles 存储 Brand DNA 配置。
5. 后续迭代规划 (Roadmap)
v1.1 (短期)
视频扩展 (Extend Video)：支持基于现有视频生成后续 5 秒内容（Veo 模型能力）。
时间轴编辑 (Timeline)：在底部增加简易时间轴，允许将画板上的多个视频片段拼接。
v1.2 (中期)
由视频生成声音 (Video-to-Audio)：利用 Gemini 1.5 Pro 的多模态能力，为生成的静音视频配乐或生成音效。
批量变体 (Batch Variations)：一键生成同一 Prompt 的 4 种不同运镜版本。
v2.0 (长期)
3D 资产生成：引入 3D 模型生成，支持在画板上进行简单的 3D 运镜预演。
团队协作：支持多人同时在画板上操作，共享 Brand DNA。
总结
AideaGLO Short Reel 模块通过 "Hybrid Canvas" 的形态，解决了传统工作流中图片工具与视频工具割裂的问题。它利用 Gemini 强大的多模态理解与生成能力，让创作者能够在一个界面内完成从静态视觉设计到动态视频生产的全过程闭环。