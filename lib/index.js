"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const getReviewComments_1 = require("./getReviewComments");
const article = fs_1.default
    .readFileSync(path_1.default.resolve(__dirname, "./article.diff"))
    .toString();
(0, getReviewComments_1.getComments)(article).then(console.log);
