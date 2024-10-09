import { readFileSync } from "fs";
import { Octokit } from "@octokit/rest";

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
}

export const getGithubClient = (githubToken: string) => {
  const octokit = new Octokit({ auth: githubToken });

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

  return {
    getPRDetails,
    getDiff,
    createReviewComment,
  };
};
