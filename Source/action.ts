import * as core from '@actions/core';
import * as github from '@actions/github';
import { Logger } from '@woksin/github-actions.shared.logging';
const analyzer = require('@semantic-release/commit-analyzer');

// const commitAnalyzer = require('@semantic-release/commit-analyzer');

const logger = new Logger();

run();
export async function run() {
    try {
        const token = core.getInput('token', {required: true});
        const {owner, repo} = github.context.repo;
        const client = github.getOctokit(token, {owner, repo});
        const prNumber = await getPrNumber();
        const x = await client.rest.pulls.listCommits({owner, repo, pull_number: prNumber, per_page: 100})
        const commits = x.data.map(_ => ({message: _.commit.message, hash: _.sha}));

        // const result = await semanticRelease({ci: true, dryRun: true, plugins: ['@semantic-release/commit-analyzer']});
        const releaseType = analyzer.analyzeCommits({preset: 'angular'} as any, {commits} as any);
        if (releaseType) {
            logger.info(releaseType);
            const label = releaseType;
            await client.rest.issues.addLabels({
                issue_number: prNumber,
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                labels: label.startsWith('pre') ? [] : [label]
            });
        }
        outputResult(releaseType);
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

function outputResult(releaseType: string | null) {
    if (!releaseType) {
        core.setOutput('is-release', false);
        return;
    }
    core.setOutput('is-release', true);
    core.setOutput('release-type', releaseType);
}

function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
