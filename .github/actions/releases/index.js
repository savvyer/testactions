const core = require("@actions/core");
const github = require("@actions/github");

const getNewDateStamp = () => {
  const todayYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth() + 1; // .getMonth() returns a zero-based value -> inc by 1

  const newDateStamp =
    `${todayYear.toString().slice(2)}` +
    `${todayMonth.toString().padStart(2, "0")}`;

  return newDateStamp;
};

const getNewBuildNumber = (shouldResetBuild, lastBuildNumber) => {
  const lastBuildNum = shouldResetBuild ? 0 : parseInt(lastBuildNumber) || 0;
  const newBuildNum = (lastBuildNum + 1).toString().padStart(4, "0");

  return newBuildNum;
};

/**
 * Version numbers take the form of: YYMM.xxxx
 *   a two digit year, a two digit month, followed by a
 *   zero padded incremented build number, reset as the
 *   date stamp changes
 *
 * Example:
 *   - Release: March 2021 - 5th build this month
 *     Version: 2103.0005
 */
const getNewVersionNumber = (lastVersionNumber) => {
  const [lastDateStamp, lastBuildNumber] = lastVersionNumber.split(".");
  const newDateStamp = getNewDateStamp();

  const shouldResetBuild = lastDateStamp !== newDateStamp;
  const newBuildNumber = getNewBuildNumber(shouldResetBuild, lastBuildNumber);

  const newVersion = `${newDateStamp}.${newBuildNumber}`;
  return newVersion;
};

const getLastReleaseData = async (octokit, owner, repo) => {
  let lastReleaseData;
  const lastRelease = await octokit.rest.repos.getLatestRelease({
    owner,
    repo,
  });
  lastReleaseData = lastRelease.data;

  return lastReleaseData;
};

const createNewRelease = async (
  octokit,
  owner,
  repo,
  targetCommitSHA
) => {
  console.log("!!! targetCommitSHA", targetCommitSHA);
  const lastRelease = await getLastReleaseData(octokit, owner, repo);
  const newVersion = getNewVersionNumber(lastRelease.tag_name);
  const { data: releaseData } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    name: `v${newVersion}`,
    tag_name: newVersion,
    //target_commitish: targetCommitSHA,
    generate_release_notes: true,
  });
  return { version: releaseData.tag_name, changelog: releaseData.body, url: releaseData.html_url };
};

async function run() {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    const { payload } = github.context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const targetCommitSHA = core.getInput("TARGET_COMMIT_SHA");
    const githubToken = core.getInput("RELEASE_TOKEN");
    const octokit = github.getOctokit(githubToken);

    const { version, changelog } = await createNewRelease(
      octokit,
      owner,
      repo,
      targetCommitSHA
    );

    core.setOutput('CHANGELOG_MESSAGE', changelog);
    core.setOutput('VERSION', version);
    core.setOutput('RELEASE_URL', url);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
