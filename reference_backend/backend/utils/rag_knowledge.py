"""
RAG Knowledge Base
内部知识库精选文章
"""

RAG_KNOWLEDGE_BASE = [
    {
        'industryKeywords': ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        'title': '2024年摄影师必备的12款相机配件',
        'url': 'https://www.dpreview.com/reviews/buying-guide-best-accessories-for-your-new-dslr',
        'reason': '文章通过全面的清单和实用建议，有效覆盖了从入门到专业的广泛用户群体，是典型的"指南类"高流量内容。'
    },
    {
        'industryKeywords': ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        'title': '相机三脚架深度评测：Manfrotto vs. Gitzo，谁是王者？',
        'url': 'https://www.bhphotovideo.com/explora/photography/buying-guide/a-guide-to-tripods',
        'reason': '通过深度对比评测，直接影响高意向用户的购买决策，精准捕获了具有商业价值的关键词。'
    },
    {
        'industryKeywords': ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        'title': '如何清洁你的相机传感器？（附分步图解）',
        'url': 'https://photographylife.com/how-to-clean-dslr-sensor',
        'reason': '这种"How-to"类型的内容精准解决了用户的核心痛点，极易获得长尾流量和社交媒体分享。'
    },
]


def search_rag_by_industry(industry: str, limit: int = 3) -> list:
    """
    根据行业搜索 RAG 知识库
    
    Args:
        industry: 行业关键词
        limit: 返回结果数量限制
    
    Returns:
        匹配的文章列表
    """
    if not industry:
        return []
    
    industry_lower = industry.lower()
    matched = []
    
    for article in RAG_KNOWLEDGE_BASE:
        keywords = article.get('industryKeywords', [])
        if any(keyword.lower() in industry_lower for keyword in keywords):
            matched.append(article)
            if len(matched) >= limit:
                break
    
    return matched

