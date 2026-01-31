
export interface AiSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  prompt: string;
  streaming: boolean;
  superMode?: boolean;
}

export async function getAiAnalysis(
  question: string,
  settings: AiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    if (!settings.apiKey) {
      if (settings.streaming && onChunk) {
        // 模拟流式输出
        const mockAnalysis = getMockAnalysisText(question);
        const chunks = mockAnalysis.split(" ");

        let cumulativeText = "";
        const delay = (ms: number) =>
          new Promise(resolve => setTimeout(resolve, ms));

        for (const chunk of chunks) {
          await delay(50);
          cumulativeText += chunk + " ";
          onChunk(cumulativeText);
        }

        return cumulativeText;
      }
      return getMockAnalysis(question);
    }

    // 替换提示词中的问题占位符
    const processedPrompt = settings.prompt.replace("{question}", question);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: processedPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }

    if (settings.streaming && onChunk) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let cumulativeText = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        cumulativeText += text;
        onChunk(cleanAiResponse(cumulativeText));
      }

      const text = decoder.decode();
      if (text) {
        cumulativeText += text;
        onChunk(cleanAiResponse(cumulativeText));
      }

      return cleanAiResponse(cumulativeText);
    } else {
      const text = await response.text();
      return cleanAiResponse(text);
    }
  } catch (error) {
    console.error("AI API调用失败:", error);
    return `分析生成失败: ${error instanceof Error ? error.message : "未知错误"}`;
  }
}

// 当用户没有设置API密钥时使用的模拟数据
function getMockAnalysisText(question: string): string {
  return `# 模拟AI分析（未配置API密钥）

## 问题本质与考察点
这是一个关于 **"${question}"** 的模拟分析展示。
真实的AI分析会深入解析该问题的技术细节，但由于您尚未配置 API Key，此处仅展示排版效果。

**考察重点通常包括：**
- 对核心概念的准确理解
- 实际场景下的应用能力
- 代码实现的规范性
- 性能优化意识

## 建议回答 (模拟)
*"这个问题在实际开发中非常常见。我认为它的核心在于..."*

**STAR法则示例：**
- **Situation:** 在我之前的项目中，负责重构高频交互组件...
- **Task:**哪怕数据量达到万级，也要保证滚动流畅...
- **Action:** 我使用了虚拟滚动(Virtual Scrolling)技术...
- **Result:** 渲染性能提升了 10 倍，FPS 稳定在 60。

## 代码实战 (模拟)
\`\`\`javascript
function mockDemonstration() {
  console.log("这只是一个模拟的代码块");
  // 真实的AI会在这里生成针对 "${question}" 的具体代码
  const answer = {
    concept: "清晰",
    practice: "扎实",
    highlight: "源码级理解"
  };
  return answer;
}
\`\`\`

## 亮点/加分项
- **源码视角:** 提及 React/Vue 源码中是如何处理此类问题的
- **性能优化:** 分析不同实现方案的时间复杂度 (Big O)
- **前沿趋势:** 聊聊 Server Components 或 WASM 对该领域的影响

## 避坑指南
- ❌ 避免死记硬背概念，要结合实际场景
- ❌ 不要只说"是什么"，忽略了"为什么"

> **提示:** 要启用真实的 AI 智能分析，请点击右上角设置图标，填入您的 OpenAI API Key (需支持 gpt-4 或兼容模型)。`;
}

// 当用户没有设置API密钥时使用的模拟数据
function getMockAnalysis(question: string): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(getMockAnalysisText(question));
    }, 1000);
  });
}

// 过滤掉 AI 思考过程的标签
export function cleanAiResponse(text: string): string {
  // 移除完整的 <think>...</think> 块
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // 移除末尾可能存在的未闭合 <think>...
  cleaned = cleaned.replace(/<think>[\s\S]*$/, "");
  return cleaned;
}
