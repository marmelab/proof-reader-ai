import { readFileSync } from "fs";
import { Octokit } from "@octokit/rest";
import parseDiff, { File } from "parse-diff";
import { analyzeArticle } from "./analyzeArticle";

const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN as string;
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY as string;
const OPENAI_API_MODEL: string = process.env.OPENAI_API_MODEL as string;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

async function analyzePR(
  parsedDiff: File[]
): Promise<Array<{ body: string; path: string; line: number }>> {
  const comments: Array<{ body: string; path: string; line: number }> = [];

  for (const file of parsedDiff) {
    if (file.to === "/dev/null") continue; // Ignore deleted files
    for (const chunk of file.chunks) {
      const diff = `${chunk.content}
${chunk.changes
  // @ts-expect-error - ln and ln2 exists where needed
  .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
  .join("\n")}`;
      const newComments = await analyzeArticle({
        apiKey: OPENAI_API_KEY,
        diff,
        model: OPENAI_API_MODEL,
        path: file.to!,
      });
      if (newComments && newComments.length > 0) {
        comments.push(...newComments);
      }
    }
  }
  return comments;
}

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

  const comments = await analyzePR(filteredDiff);
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
