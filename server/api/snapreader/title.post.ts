export default defineEventHandler(async (event) => {
    const body = await readBody<{ transcript?: string }>(event);
    const transcript = body?.transcript;

    if (!transcript) {
        throw createError({
            statusCode: 400,
            statusMessage: 'transcript is required',
        });
    }

    const { openaiApiKey } = useRuntimeConfig();

    if (!openaiApiKey) {
        throw createError({
            statusCode: 500,
            statusMessage: 'OpenAI API key is not configured.',
        });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                input: [
                    {
                        role: 'user',
                        content: `以下のテキストの内容を表す簡潔なタイトルを日本語で8文字以内で出力してください。タイトルのみ出力し、それ以外は何も出力しないこと。\n\n${transcript}`,
                    },
                ],
                max_output_tokens: 20,
            }),
        });

        const data = await response.json().catch(() => null as any);

        if (!response.ok) {
            const openAiMessage = data?.error?.message || 'タイトル生成に失敗しました。';
            throw createError({
                statusCode: response.status || 500,
                statusMessage: openAiMessage,
            });
        }

        const title =
            data?.output_text ||
            data?.output?.[0]?.content?.find?.((chunk: any) => 'text' in chunk)?.text ||
            '';

        return { title: title.trim().slice(0, 8) };
    } catch (err: any) {
        if (err?.statusCode && err?.statusMessage) {
            throw err;
        }

        const message = err?.message || 'タイトル生成に失敗しました。';
        throw createError({
            statusCode: 500,
            statusMessage: message,
        });
    }
});
