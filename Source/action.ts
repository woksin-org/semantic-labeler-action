import * as core from '@actions/core';
import * as github from '@actions/github';
import { Logger } from '@woksin/github-actions.shared.logging';
const analyzer = require('@semantic-release/commit-analyzer');
import semanticRelease, { Result } from 'semantic-release';
const commitAnalyzer = require('@semantic-release/commit-analyzer');

const logger = new Logger();

run();
export async function run() {
    try {
        const token = core.getInput('token', {required: true});
        const {owner, repo} = github.context.repo;
        logger.info('Getting octokit');
        const client = github.getOctokit(token, {owner, repo});
        logger.info('Getting PR number');
        const prNumber = await getPrNumber();
        logger.info('Getting commits');
        // const x = await client.rest.pulls.listCommits({owner, repo, pull_number: prNumber, per_page: 100});
        // const commits = x.data.map(_ => ({message: _.commit.message, hash: _.sha}));

        require('debug').enable('semantic-release:*');
        delete process.env.GITHUB_ACTIONS;
        delete process.env.GITHUB_EVENT_NAME;
        const result = await semanticRelease({ci: false, debug: true, dryRun: true, branches: ['*', '**', github.context.ref], plugins: ['@semantic-release/commit-analyzer']}, {});
        // logger.info('Analyzing commits');
        // const releaseType = analyzer.analyzeCommits({preset: 'angular'} as any, {commits} as any);
        logger.info(JSON.stringify(result, undefined, 2));
        if (result) {

            const releaseType = result.nextRelease.type;
            logger.info(releaseType);
            const label = releaseType;
            await client.rest.issues.addLabels({
                issue_number: prNumber,
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                labels: label.startsWith('pre') ? [] : [label]
            });
        }
        // outputResult(releaseType);
    } catch (error: any) {
        fail(error);
    }
}

async function getPrNumber() {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        throw new Error('Failed to get pull request context');
    }
    return pr.number;
}

function outputResult(releaseType: Result) {
    if (!releaseType) {
        core.setOutput('is-release', false);
        return;
    }
    core.setOutput('is-release', true);
    core.setOutput('release-type', releaseType.nextRelease.type);
}
// function outputResult(releaseType: string | null) {
//     if (!releaseType) {
//         core.setOutput('is-release', false);
//         return;
//     }
//     core.setOutput('is-release', true);
//     core.setOutput('release-type', releaseType);
// }

function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
