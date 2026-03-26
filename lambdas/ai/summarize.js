const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function summarize(text) {
  const prompt = `
You are summarizing a chat conversation.

Your job:
- Understand the overall discussion, not just individual lines
- Identify the main topic
- Mention key points, concerns, agreements, disagreements, and decisions
- Include next steps if they exist
- Ignore meaningless filler or gibberish unless it affects the conversation
- Do NOT list each message one by one
- Do NOT say "the text consists of..."
- Write a natural, human summary in 3 to 5 sentences

Conversation:
${text}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that writes concise, contextual conversation summaries.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  return response.choices?.[0]?.message?.content?.trim() || "No summary generated.";
};