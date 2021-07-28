const core = require('@actions/core');
const { Octokit } = require("@octokit/rest");
const fs = require("fs")
const { execSync } = require("child_process")

async function downloadRelease(octokit, org, repo, release) {
    const releaseAssets = await octokit.rest.repos.listReleaseAssets({
        owner: org,
        repo: repo,
        release_id: release.id,
    })
    for (let asset of releaseAssets.data) {
        console.log("Examining release asset " + asset.name + " at " + asset.browser_download_url + "...")
        if (asset.name.endsWith("_linux_amd64.tar.gz")) {
            console.log("Found Linux binary named " + asset.name + " at " + asset.browser_download_url + ", attempting download...")
            const response = await octokit.request("GET " + asset.browser_download_url)
            console.log("Writing gotestfmt to ./tmp/gotestfmt.tar.gz...")
            fs.writeFileSync("/tmp/gotestfmt.tar.gz", response.data)
            console.log("Creating /usr/local/lib/gotestfmt directory...")
            fs.mkdirSync("/usr/local/lib/gotestfmt")
            console.log("Unpacking tar file...")
            execSync("cd /usr/local/lib/gotestfmt && tar -xvzf /tmp/gotestfmt.tar.gz")
            console.log("Removing tarball...")
            fs.unlinkSync("/tmp/gotestfmt.tar.gz")
            console.log("Linking gotestfmt...")
            fs.symlinkSync("/usr/local/bin/gotestfmt", "/usr/local/lib/gotestfmt/gotestfmt")
            console.log("Successfully set up gotestfmt.")
            return
        }
    }
    throw "No release asset matched criteria."
}

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
    let tries = 0
    for (let release of releases.data) {
        if ((version !== "" && release.name === version) || (!release.prerelease && release.name.startsWith(versionPrefix))) {
            console.log("Found release " + release.name + " matching criteria, attempting to download binary...")
            try {
                await downloadRelease(octokit, org, repo, release)
                return
            } catch (e) {
                tries++
                if (tries > 3) {
                    console.log("Binary download failed, tried " + tries + " times, giving up. (" + e + ")")
                    throw e
                }
                console.log("Binary download failed, trying next release. (" + e + ")")
            }
        }
    }
    throw "Failed to find a release matching the criteria."
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