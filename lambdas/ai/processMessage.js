import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Content-Type": "application/json",
  };

  try {
    const body = JSON.parse(event.body || "{}");
    const { text, task } = body;

    if (!text || !task) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "task and text are required" }),
      };
    }

    let systemMessage = "You are a helpful AI assistant.";
    let userPrompt = "";

    if (task === "summarize") {
      systemMessage =
        "You are a helpful assistant that writes concise, contextual summaries of conversations.";
      userPrompt = `
Summarize the following conversation naturally.

Rules:
- Focus on the overall context and meaning
- Identify the main topic being discussed
- Mention important points, agreements, disagreements, and decisions
- Mention next steps if any exist
- Ignore meaningless filler or gibberish unless it changes the meaning
- Do NOT list each line one by one
- Do NOT say phrases like "the text consists of" or "the conversation includes"
- Write a short human-style summary in 3 to 5 sentences

Conversation:
${text}
`;
    } else if (task === "rewrite") {
      systemMessage =
        "You rewrite text to make it clearer, more polished, and more professional.";
      userPrompt = `
Rewrite the following text to make it clearer and more professional.

Text:
${text}
`;
    } else if (task === "factcheck") {
      systemMessage =
        "You evaluate factual reliability carefully and explain uncertainty clearly.";
      userPrompt = `
Analyze the factual reliability of the following statement.
Give a short assessment and explain your confidence level.

Statement:
${text}
`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid task type" }),
      };
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: task === "summarize" ? 0.3 : 0.5,
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const result =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No result generated.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        task,
        result,
      }),
    };
  } catch (error) {
    console.error("AI Lambda error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "AI processing failed",
        details: error.message,
      }),
    };
  }
};