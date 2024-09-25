import { readFileSync } from "fs";
import * as core from "@actions/core";
import OpenAI from "openai";
// eslint-disable-next-line import/no-unresolved
import { Octokit } from "@octokit/rest";
import parseDiff, { Chunk, File } from "parse-diff";

const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN as string; // core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY as string; // core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL: string = "gpt-3.5-turbo";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
}

async function getPRDetails(): Promise<PRDetails> {
  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const prResponse = await octokit.pulls.get({
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
  });
  return {
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
    title: prResponse.data.title ?? "",
    description: prResponse.data.body ?? "",
  };
}

async function getDiff(
  owner: string,
  repo: string,
  pull_number: number
): Promise<string | null> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  // @ts-expect-error - response.data is a string
  return response.data;
}

async function analyzeCode(
  parsedDiff: File[]
): Promise<Array<{ body: string; path: string; line: number }>> {
  const comments: Array<{ body: string; path: string; line: number }> = [];

  for (const file of parsedDiff) {
    if (file.to === "/dev/null") continue; // Ignore deleted files
    for (const chunk of file.chunks) {
      const prompt = createPrompt(file, chunk);
      const aiResponse = await getAIResponse(prompt, chunk, file.to!);
      if (aiResponse) {
        comments.push(...aiResponse);
      }
    }
  }
  return comments;
}

function createPrompt(file: File, chunk: Chunk): string {
  return `Your task is to review pull requests on Marmelab technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format (with no wrapping):

  [
    {
      "comment": "<comment targetting one line>",
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
${chunk.content}
${chunk.changes
  // @ts-expect-error - ln and ln2 exists where needed
  .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
  .join("\n")}
\`\`\`
`;
}

async function getAIResponse(
  prompt: string,
  chunk: Chunk,
  path: string
): Promise<
  {
    line: number;
    path: string;
    body: string;
  }[]
> {
  const article = `${chunk.content}
${chunk.changes
  // @ts-expect-error - ln and ln2 exists where needed
  .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
  .join("\n")}`;

  const queryConfig = {
    model: OPENAI_API_MODEL,
    temperature: 0.2,
    max_tokens: 700,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  try {
    const response = await openai.chat.completions.create({
      ...queryConfig,
      // return JSON if the model supports it:
      ...(OPENAI_API_MODEL === "gpt-4-1106-preview"
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    const res = response.choices[0].message?.content?.trim() || "[]";
    const result = JSON.parse(res);

    const articleLines = article
      .split("\n")
      .map((line, index) => ({ text: line, number: index + 1 }));

    const resultWithLineNumber = result.map((item: any) => {
      const originalLine = item.originalText;

      if (!item.originalText) {
        console.error(`Incorrect originalText in item ${JSON.stringify(item)}`);
        return item;
      }

      const position = articleLines.find(({ text }) =>
        text.includes(originalLine)
      )?.number;

      if (!position) {
        console.error(
          `Could not find position for item ${JSON.stringify(item)}`
        );
        return item;
      }

      return {
        ...item,
        position,
      };
    });

    const comments: {
      line: number;
      path: string;
      body: string;
    }[] = resultWithLineNumber
      .filter(({ position }: any) => position !== undefined)
      .map((item: any) => ({
        line: item.position,
        path,
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
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

// eslint-disable-next-line no-unused-vars
async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<{ body: string; path: string; line: number }>
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: "COMMENT",
  });
}

async function main() {
  const prDetails = await getPRDetails();
  let diff: string | null;

  diff = await getDiff(prDetails.owner, prDetails.repo, prDetails.pull_number);

  if (!diff) {
    console.log("No diff found");
    return;
  }

  const parsedDiff = parseDiff(diff);
  console.log("parsedDiff", parsedDiff);

  const filteredDiff = parsedDiff.filter((file) => {
    console.log("file.to", file.to);
    return /.mdx$/.test(file.to ?? "");
  });

  console.log("filteredDiff", filteredDiff);

  const comments = await analyzeCode(filteredDiff);
  console.log("comments:", comments);
  if (comments.length > 0) {
    await createReviewComment(
      prDetails.owner,
      prDetails.repo,
      prDetails.pull_number,
      comments
    );
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
