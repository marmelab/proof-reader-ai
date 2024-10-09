import parseDiff, { File } from "parse-diff";
import { generateAICommentsForMarkdownFiles } from "./generateAICommentsForMarkdownFiles";
import { getGithubClient } from "./getGithubClient";

const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN as string;
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY as string;
const OPENAI_API_MODEL: string = process.env.OPENAI_API_MODEL as string;

const githubCli = getGithubClient(GITHUB_TOKEN);

async function main() {
  const prDetails = await githubCli.getPRDetails();

  const diff = await githubCli.getDiff(
    prDetails.owner,
    prDetails.repo,
    prDetails.pull_number
  );

  if (!diff) {
    console.log("No diff found");
    return;
  }

  const parsedDiff = parseDiff(diff);

  const filteredDiff = parsedDiff.filter((file) => {
    return /.mdx$/.test(file.to ?? "");
  });

  const comments = await generateAICommentsForMarkdownFiles({
    parsedDiff: filteredDiff,
    apiKey: OPENAI_API_KEY,
    model: OPENAI_API_MODEL,
  });

  if (comments.length > 0) {
    await githubCli.createReviewComment(
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
