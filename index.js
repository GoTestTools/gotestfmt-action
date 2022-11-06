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

    // Determine environment specific details, paths etc...
    const postfix = `_${os}_amd64.${os === "windows" ? "zip" : "tar.gz"}`;
    const tempdir = os === "windows" ? process.env.TEMP + "\\" : "/tmp/";
    const binpath = os === "windows" ? "C:\\Windows\\System32" : "/usr/local/bin";
    const extract = os === "windows" ? "tar -xvf" : "tar -xvzf";
    const archive = `${tempdir}gotestfmt${postfix}`;

    // Search through the latest release assets for an install canidate
    for (let asset of releaseAssets.data) {
        // Check if the asset name matches the determined postfix
        console.log("Examining release asset " + asset.name + " at " + asset.browser_download_url + " ...")
        if (asset.name.endsWith(postfix)) {
            // Download the selected release asset archive
            console.log("Found binary named " + asset.name + " at " + asset.browser_download_url + " , attempting download...")
            if (token) {
                // Use the token to avoid rate limits
                execSync(`curl -L -o ${archive} -H "Authorization: Bearer ${token}" ${asset.browser_download_url}`)
            } else {
                // Fallback to unauthenticated requests (might get rate limited)
                execSync(`curl -L -o ${archive} ${asset.browser_download_url}`)
            }

            // Extract the archive into the install target
            console.log("Unpacking archive file...")
            execSync(`cd "${binpath}" && ${extract} ${archive}`)

            // Remove the downloaded asset archive
            console.log("Removing asset archive...")
            fs.unlinkSync(archive)

            // Successfully installed gotestfmt, return early
            console.log("Successfully set up gotestfmt.")
            return
        }
    }

    // Throw an error if no asset matched the expected postfix
    throw `No release asset matched postfix '${postfix}'.`
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
    const uname = execSync("uname")

    let os = uname.toString().trim().toLowerCase()
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
