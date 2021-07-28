const core = require('@actions/core');
const { Octokit } = require("@octokit/rest");

async function downloadGofmt(octokit, version, versionPrefix, org, repo) {
    if (version !== "") {
        if (!version.startsWith(versionPrefix)) {
            throw "Specified version " + version + " does not start with required version prefix " + versionPrefix + "."
        }
        console.log("Downloading gotestfmt version " + version + " from " + org + "/" + repo + "...")
    } else {
        console.log("Downloading latest stable gotestfmt version starting with " + versionPrefix + " from " + org + "/" + repo + "...")
    }
    const releases = await octokit.rest.repos.listReleases({
        owner: org,
        repo: repo
        // No pagination added, we are optimistic that there is a stable release within the first 100
        // releases.
    })
    console.log(releases)
    for (let release of releases) {

    }
}

try {
    // versionPrefix is the prefix of the version gotestfmt-action supports.
    const versionPrefix = "v1."
    const token = core.getInput('token');
    const version = core.getInput('version');
    const org = core.getInput("org")
    const repo = core.getInput("repo")
    const octokit = new Octokit({
        auth: token,
    })
    downloadGofmt(octokit, version, versionPrefix, org, repo).then(function () {
        console.log("Download successful.")
    }).catch(reason => function() {
        core.setFailed(reason);
    })
} catch (error) {
    core.setFailed(error.message);
}