import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

export const maxDuration = 60;

export async function POST(req: Request) {
    const { prompt, apiKey, baseUrl, model } = await req.json();

    if (!apiKey) {
        return new Response('API Key is required', { status: 401 });
    }

    // 使用 createOpenAICompatible
    const openaiCompatible = createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: baseUrl || 'https://api.openai.com/v1',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    try {
        const result = streamText({
            model: openaiCompatible(model || 'gpt-5-mini'),
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        // 返回 raw text stream
        return new Response(result.textStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to generate analysis' }), {
            status: 500,
        });
    }
}
