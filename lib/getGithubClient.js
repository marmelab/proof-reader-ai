"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGithubClient = void 0;
const fs_1 = require("fs");
const rest_1 = require("@octokit/rest");
const getGithubClient = (githubToken) => {
    const octokit = new rest_1.Octokit({ auth: githubToken });
    function getPRDetails() {
        return __awaiter(this, void 0, void 0, function* () {
            const { repository, number } = JSON.parse((0, fs_1.readFileSync)(process.env.GITHUB_EVENT_PATH || "", "utf8"));
            return {
                owner: repository.owner.login,
                repo: repository.name,
                pull_number: number,
            };
        });
    }
    function getDiff(owner, repo, pull_number) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield octokit.pulls.get({
                owner,
                repo,
                pull_number,
                mediaType: { format: "diff" },
            });
            // @ts-expect-error - response.data is a string
            return response.data;
        });
    }
    function createReviewComment(owner, repo, pull_number, comments) {
        return __awaiter(this, void 0, void 0, function* () {
            yield octokit.pulls.createReview({
                owner,
                repo,
                pull_number,
                comments,
                event: "COMMENT",
            });
        });
    }
    return {
        getPRDetails,
        getDiff,
        createReviewComment,
    };
};
exports.getGithubClient = getGithubClient;
