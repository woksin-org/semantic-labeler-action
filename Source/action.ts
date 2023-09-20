import * as core from '@actions/core';
import * as github from '@actions/github';
import { Logger } from '@woksin/github-actions.shared.logging';
import semanticRelease, { Result } from 'semantic-release';

const logger = new Logger();
const branch: string = github.context.payload.pull_request!.head.ref;

run();
export async function run() {
    try {
        const token = core.getInput('token', {required: true});
        const tagFormat = core.getInput('tag-format', {required: false});
        setEnvironmentHacks();
        const result = await semanticRelease({
            ci: false, dryRun: true,
            branch,
            tagFormat: tagFormat ? tagFormat : undefined,
            branches: ['*', branch, github.context.ref],
            plugins: ['@semantic-release/commit-analyzer']}, {});
        if (result) {
            const releaseType = result.nextRelease.type;
            logger.info(`Found release type: ${releaseType}`);
            await setReleaseLabel(token, releaseType);
        }
        outputResult(result);
    } catch (error: any) {
        fail(error);
    }
}

async function setReleaseLabel(token: string, releaseType: string) {
    if (releaseType.startsWith('pre')) {
        return;
    }
    const {owner, repo} = github.context.repo;
    const client = github.getOctokit(token, {owner, repo});
    const prNumber = await getPrNumber();
    for (const label of ['patch', 'minor', 'major']) {
        try {
            logger.info(`Trying to remove '${label}' label`);
            await client.rest.issues.removeLabel({
                issue_number: prNumber,
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                name: label
            });
        } catch(err) {
            logger.warning(`Failed: ${err}`);
        }
    }
    await client.rest.issues.addLabels({
        issue_number: prNumber,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        labels: [releaseType]
    });
}

/**
 * By looking at how semantic-release I determined that I could trick the system to get me the semantic version by
 * tricking it a bit.
 */
function setEnvironmentHacks() {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_EVENT_NAME;
    process.env.APPVEYOR = 'true';
    process.env.APPVEYOR_REPO_BRANCH = branch;
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
    core.setOutput('release-name', releaseType.nextRelease.name);
    core.setOutput('release-notes', releaseType.nextRelease.notes);
}

function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
