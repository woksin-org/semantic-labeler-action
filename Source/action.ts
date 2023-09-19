import * as core from '@actions/core';
import { Logger } from '@woksin/github-actions.shared.logging';

const logger = new Logger();

run();
export async function run() {
    try {
        // Put your code in here
    } catch (error) {
        fail(error);
    }
}


function fail(error: Error) {
    logger.error(error.message);
    core.setFailed(error.message);
}
