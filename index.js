const core = require('@actions/core');
const { Octokit } = require("@octokit/rest");
const fs = require("fs")
const { execSync } = require("child_process")

async function downloadRelease(octokit, os, org, repo, release, token) {
    const releaseAssets = await octokit.rest.repos.listReleaseAssets({
        owner: org,
        repo: repo,
        release_id: release.id,
    })
    tarPostfix = `_${os}_amd64.tar.gz`
    for (let asset of releaseAssets.data) {
        console.log("Examining release asset " + asset.name + " at " + asset.browser_download_url + " ...")
        if (asset.name.endsWith(tarPostfix)) {
            console.log("Found Linux binary named " + asset.name + " at " + asset.browser_download_url + " , attempting download...")
            if (token) {
                execSync("curl -L -o /tmp/gotestfmt.tar.gz -H \"Authorization: Bearer " + token + "\" " + asset.browser_download_url)
            } else {
                execSync("curl -L -o /tmp/gotestfmt.tar.gz " + asset.browser_download_url)
            }
            console.log("Creating /usr/local/lib/gotestfmt directory...")
            execSync("sudo mkdir -p /usr/local/lib/gotestfmt")
            console.log("Unpacking tar file...")
            execSync("cd /usr/local/lib/gotestfmt && sudo tar -xvzf /tmp/gotestfmt.tar.gz")
            console.log("Removing tarball...")
            fs.unlinkSync("/tmp/gotestfmt.tar.gz")
            console.log("Creating /usr/local/bin directory if it does not exist already...")
            execSync("sudo mkdir -p /usr/local/bin")
            console.log("Linking gotestfmt...")
            execSync("sudo ln -s /usr/local/lib/gotestfmt/gotestfmt /usr/local/bin/gotestfmt")
            console.log("Successfully set up gotestfmt.")
            return
        }
    }
    throw `No release asset matched postfix '${tarPostfix}'.`
}

async function downloadGofmt(octokit, version, versionPrefix, os, org, repo, token) {
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
                await downloadRelease(octokit, os, org, repo, release, token)
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
    console.log("Failed to find a release matching the criteria.")
    throw "Failed to find a release matching the criteria."
}

async function determineOS() {
    const os = execSync("uname").toString().trim().toLowerCase()

    if (os.indexOf("msys_nt") === 0)
    {
        os = "windows";
    }

    console.log(`Running on OS '${os}'`)
    return os
}

async function main() {
    try {
        // versionPrefix is the prefix of the version gotestfmt-action supports.
        const versionPrefix = "v2."
        const token = core.getInput('token');
        const version = core.getInput('version');
        const org = core.getInput("org")
        const repo = core.getInput("repo")
        const octokit = new Octokit({
            auth: token,
        })
        const os = await determineOS()
        await downloadGofmt(octokit, version, versionPrefix, os, org, repo, token)
        console.log("Setup complete.")
    } catch (error) {
        console.log("Setup failed.")
        core.setFailed(error);
    }
}

main()
