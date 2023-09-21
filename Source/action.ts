import * as core from '@actions/core';
import * as github from '@actions/github';
import { OctokitResponse } from '@octokit/types';
import { Logger } from '@woksin/github-actions.shared.logging';
import semanticRelease, { Result, NextRelease } from 'semantic-release';
import { RELEASE_TYPES, ReleaseType } from 'semver';

const inputs = {
    token: 'token',
    tagFormat: 'tag-format',
    debug: 'debug',
    commitPreset: 'commit-preset',
    commitReleaseRules: 'commit-release-rules',
    commitConfig: 'commit-config'
};
const outputs = {
    isRelease: 'is-release',
    releaseType: 'release-type',
    releaseNotes: 'release-notes',
    releaseName: 'release-name'
};

const logger = new Logger();
const branch: string = github.context.payload.pull_request!.head.ref;

run();
export async function run() {
    try {
        const token = core.getInput(inputs.token, {required: true});
        const debug = core.getBooleanInput(inputs.debug, {required: true});
        const tagFormat = core.getInput(inputs.tagFormat, {required: true});
        const commitPreset = core.getInput(inputs.commitPreset, {required: false});
        const commitReleaseRules = core.getInput(inputs.commitReleaseRules, {required: false});
        const commitConfig = core.getInput(inputs.commitConfig, {required: false});

        setEnvironmentHacks();
        if (debug) {
            require('debug').enable('semantic-release:*');
        }

        const result = await semanticRelease({
            ci: false, dryRun: true,
            branch,
            tagFormat: tagFormat ? tagFormat : undefined,
            branches: ['*', branch, github.context.ref],
            plugins: ['@semantic-release/commit-analyzer'],
            preset: commitPreset ? commitPreset : undefined,
            releaseRules: commitReleaseRules ? commitReleaseRules : undefined,
            config: commitConfig ? commitConfig : undefined
        }, {});
        if (result) {
            const release = result.nextRelease;
            logger.info(`Found release type: ${release.type}`);
            await setReleaseLabel(token, release);
        }
        outputResult(result);
    } catch (error: any) {
        fail(error);
    }
}

async function setReleaseLabel(token: string, release: NextRelease) {
    if (release.type.startsWith('pre')) {
        return;
    }
    const prNumber = await getPrNumber();
    const {owner, repo} = github.context.repo;
    const client = github.getOctokit(token, {owner, repo});

    const labels = await client.rest.issues.listLabelsOnIssue({
        issue_number: prNumber,
        owner,
        repo});

    const releaseLabels = labels.data.map(_ => _.name).filter(label => RELEASE_TYPES.includes(label as ReleaseType));
    const containsCurrentRelease = releaseLabels.includes(release.type);
    if (containsCurrentRelease && releaseLabels.length === 1) {
        return;
    }

    if (releaseLabels.length > 0) {
        logger.warning(`Pull request already has release labels: ${releaseLabels.join(', ')}`);
        logger.warning(`Removing all release labels except ${release.type}`);
        for (const label of releaseLabels) {
            try {
                if (label === release.type) {
                    continue;
                };
                logger.info(`Trying to remove '${label}' label`);
                await client.rest.issues.removeLabel({
                    issue_number: prNumber,
                    owner,
                    repo,
                    name: label
                });
            } catch(err) {
                logger.warning(`Failed to remove '${label}' label: ${err}`);
            }
        }
    }

    if (!containsCurrentRelease) {
        logger.info(`Adding current release label '${release.type}'`);
        await client.rest.issues.addLabels({
            issue_number: prNumber,
            owner,
            repo,
            labels: [release.type]
        });
    }
}

/**
 * By looking at how semantic-release I determined that I could trick the system to get me the semantic version by
 * tricking it a bit.
 */
function setEnvironmentHacks() {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_EVENT_NAME;
    // Using APPVEYOR here is purely coincidental.
    process.env.APPVEYOR = 'true';
    // This is the important part, to set the branch correctly to the head branch.
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
        core.setOutput(outputs.isRelease, false);
        return;
    }
    const release = releaseType.nextRelease;
    logger.info(JSON.stringify(release, undefined, 2));
    core.setOutput(outputs.isRelease, true);
    core.setOutput(outputs.releaseType, release.type);
    core.setOutput(outputs.releaseName, release.name);
    core.setOutput(outputs.releaseNotes, release.notes);
}

function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
