import parseDiff, { File } from "parse-diff";
import OpenAI from "openai";

function createPrompt(diff: string): string {
  return `Your task is to review pull requests on a technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format, And return only the json:

[
    {
        "comment": "<comment targeting one line>",
        "lineNumber": <line_number>,
        "suggestion": "<The text to replace the existing line with. Leave empty, when no suggestion is applicable, must be related to the comment>",
        "originalLine": "<The content of the line the comment apply to>"
    }
]

- returned result must only contains valid json
- Propose change to text and code.
- Fix typo, grammar and spelling
- ensure short sentence
- ensure one idea per sentence
- simplify complex sentence.
- No more than one comment per line
- One comment can address several issues
- Provide comments and suggestions ONLY if there is something to improve or fix, otherwise return an empty array.

Git diff of the article to review:

\`\`\`diff
${diff}
\`\`\``;
}
export const getComments = async (result: ReviewItem[], path: string) => {
  const comments = result.map((item: any) => ({
    line: item.lineNumber,
    path,
    body: `${item.comment}${
      item.suggestion
        ? `
\`\`\`suggestion
${item.suggestion}
\`\`\``
        : ""
    }`,
  }));

  return comments;
};

async function getAIResponse(
  prompt: string,
  model: string,
  apiKey: string
): Promise<ReviewItem[]> {
  const openai = new OpenAI({
    apiKey,
  });
  const queryConfig = {
    model,
    temperature: 0.2,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  try {
    const response = await openai.chat.completions.create({
      ...queryConfig,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review-comments",
          schema: {
            type: "object",
            properties: {
              comments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    comment: { type: "string" },
                    suggestion: { type: "string" },
                    originalLine: { type: "string" },
                    lineNumber: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    const res =
      response.choices[0].message?.content
        ?.trim()
        .replace(/^```json/g, "")
        .replace(/```$/g, "") || "[]";

    try {
      return JSON.parse(res).comments;
    } catch (error) {
      console.log("Could not parse the prompt result:", res);
      return [];
    }
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

type ReviewItem = {
  comment: string;
  suggestion: string;
  originalLine: string;
  lineNumber: number;
};

export function checkReviewItem(
  reviewItem: ReviewItem,
  diff: string
): ReviewItem | null {
  const diffLines = diff.split("\n");
  const realLineNumber = diffLines.findIndex((line) =>
    line.includes(reviewItem.originalLine)
  );
  if (realLineNumber === -1) {
    console.log("Could not locate target line for:", reviewItem);
    return null;
  }

  if (realLineNumber + 1 === reviewItem.lineNumber) {
    return reviewItem;
  }

  return {
    ...reviewItem,
    lineNumber: realLineNumber,
  };
}
export function checkReview(review: ReviewItem[], diff: string) {
  return review
    .map((reviewItem) => checkReviewItem(reviewItem, diff))
    .filter((v) => v !== null);
}

export async function generateAICommentsForDiff({
  diff,
  path,
  apiKey,
  model,
}: {
  diff: string;
  path: string;
  model: string;
  apiKey: string;
}): Promise<Array<{ body: string; path: string; line: number }>> {
  const prompt = createPrompt(diff);
  const aiResponse = await getAIResponse(prompt, model, apiKey);
  const checkedReview = checkReview(aiResponse, diff);
  return await getComments(checkedReview, path);
}

export async function generateAICommentsForMarkdownFiles({
  parsedDiff,
  apiKey,
  model,
}: {
  parsedDiff: File[];
  apiKey: string;
  model: string;
}): Promise<Array<{ body: string; path: string; line: number }>> {
  const comments: Array<{ body: string; path: string; line: number }> = [];

  for (const file of parsedDiff) {
    if (file.to === "/dev/null") continue; // Ignore deleted files
    for (const chunk of file.chunks) {
      const diff = `${chunk.content}
  ${chunk.changes
    // @ts-expect-error - ln and ln2 exists where needed
    .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
    .join("\n")}`;
      const newComments = await generateAICommentsForDiff({
        apiKey,
        diff,
        model,
        path: file.to!,
      });
      if (newComments && newComments.length > 0) {
        comments.push(...newComments);
      }
    }
  }
  return comments;
}
