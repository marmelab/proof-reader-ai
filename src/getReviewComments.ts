import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const getComments = async (article: string) => {
  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Your task is to review pull requests on Marmelab technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format (with no wrapping):

  [
    {
      "comment": "<comment targetting one line>",
      "lineNumber": "<line_number>",
      "originalText": "<The line to be replaced by the suggestion>",
      "suggestion": "<The text to replace the existing line with. Leave empty, when no suggestion is applicable, must be related to the comment>",
    }
  ]
- Propose change to text and code.
- Fix typo, grammar and orthograph
- ensure short sentence
- ensure one idea per sentence
- simplify complex sentence.

Git diff of the article to review:

\`\`\`diff
${article}
\`\`\``,
      },
    ],
    model: "gpt-3.5-turbo",
  });

  console.log(chatCompletion.choices[0].message.content);
  const result = JSON.parse(chatCompletion.choices[0].message.content!);

  const articleLines = article
    .split("\n")
    .map((line, index) => ({ text: line, number: index + 1 }));

  const resultWithLineNumber = result.map((item: any) => {
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
    .filter(({ position }: any) => position !== undefined)
    .map((item: any) => ({
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
