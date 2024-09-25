import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const getComments = async (article: string) => {
  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `You are an experienced software developper, who write quality blog post on technical subject. Your article are well written. You write in a short and concise way, and convey your point in a straight and concise way.
Please provide a review on the following diff of an article written in markdown.
Do not explain what you're doing.
Give comments in the following json format (without wrapping it):
[
  {
    "comment": "comment targetting one line",
    "originalText": "The line to be replaced by the suggestion",
    "suggestion": "The text to replace the existing line with. Leave empty, when no suggestion is applicable, must be related to the comment",
  }
]
Propose change to text and code. Fix typo, grammar orthograph, ensure short sentence, ensure one idea per sentence, simplify complex sentence.
The article:
${article}
`,
      },
    ],
    model: "gpt-3.5-turbo",
  });

  const result = JSON.parse(chatCompletion.choices[0].message.content!);

  const articleLines = article
    .split("\n")
    .map((line, index) => ({ text: line, number: index + 1 }));

  const resultWithLineNumber = result.map((item) => {
    const originalLine = item.originalText?.split("\n");

    if (!item.originalText) {
      console.error(`Incorrect originalText in item ${JSON.stringify(item)}`);
      return item;
    }

    const position = articleLines.find(({ text }) =>
      text.includes(originalLine)
    )?.number;

    if (!position) {
      console.error(`Could not find position for item ${JSON.stringify(item)}`);
      return item;
    }

    return {
      ...item,
      position,
    };
  });

  const comments = resultWithLineNumber
    .filter(({ position }) => position !== undefined)
    .map((item) => ({
      position: item.position,
      path: "",
      body: `${item.comment}
${
  item.suggestion &&
  `
\`\`\`suggestion
${item.suggestion}
\`\`\``
}
`,
    }));

  return comments;
};
