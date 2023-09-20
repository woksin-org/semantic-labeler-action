import * as core from '@actions/core';
import * as github from '@actions/github';
import pluginRetry from '@octokit/plugin-retry';
import { Logger } from '@woksin/github-actions.shared.logging';
import semanticRelease, {Result} from 'semantic-release';

const logger = new Logger();

run();
export async function run() {
    try {
        const token = core.getInput('token', {required: true});
        const result = await semanticRelease({ci: true, dryRun: true, plugins: ['@semantic-release/commit-analyzer']});
        if (result) {
            const label = result.nextRelease.type;
            const client = github.getOctokit(token, {}, pluginRetry.retry);
            const prNumber = await getPrNumber();
            await client.rest.issues.addLabels({
                issue_number: prNumber,
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                labels: label.startsWith('pre') ? [] : [label]
            });
        }
        outputResult(result);
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

function outputResult(result: Result) {
    if (!result) {
        core.setOutput('is-release', false);
        return;
    }
    const releaseType = result.nextRelease.type;
    const channel = result.nextRelease.channel;
    const releaseNotes = result.nextRelease.notes;
    core.setOutput('is-release', true);
    core.setOutput('release-type', releaseType);
    core.setOutput('channel', channel);
    core.setOutput('release-notes', releaseNotes);
}

function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
