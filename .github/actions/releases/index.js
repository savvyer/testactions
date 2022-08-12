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
  lastRelease,
  newReleaseDescription
) => {
  const newVersion = getNewVersionNumber(lastRelease.tag_name);
  const releaseData = await octokit.rest.repos.createRelease({
    owner,
    repo,
    name: `v${newVersion}`,
    tag_name: newVersion,
    body: newReleaseDescription,
    generate_release_notes: true,
  });
  console.log("!!! releaseData", releaseData);
};

const getMergedPRs = async (
  octokit,
  owner,
  repo,
  lastRelease,
  newReleaseSHA
) => {
  let mergedPRs = [];

  const finalCommitInNewRelease = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: newReleaseSHA,
  });

  const lastReleaseTime = lastRelease.created_at;
  const newReleaseTime = finalCommitInNewRelease.data.commit.committer.date;

  const q = `repo:${owner}/${repo} merged:${lastReleaseTime}..${newReleaseTime} base:main`;
  const prSearchResults = await octokit.rest.search.issuesAndPullRequests({ q });

  mergedPRs = prSearchResults.data.items;
  return mergedPRs;
};

const extractShortcutLinks = (prBody) => {
  const shortcutRegex =
    /(https:\/\/app.shortcut.com\b\/[-a-zA-Z0-9@:%_\+.~#?&=\/\/]*)/g;
  const shortcutLinks = prBody.match(shortcutRegex) || [];
  return shortcutLinks;
};

const getReleaseSummary = (mergedPRs) => {
  const header = "# Release Changelog\n";
  let summaryOfReleasedPRs = "_Unknown_";

  const mergedPRList = mergedPRs.map((pullData) => {
    let summary = `- ${pullData.title}: ${pullData.html_url}`;
    const shortcutLinks = extractShortcutLinks(pullData.body);
    if (shortcutLinks.length) {
      summary += `\n  - Related shortcut stories:`;
      shortcutLinks.forEach((link) => {
        summary += `\n    - ${link}`;
      });
    }
    return summary;
  });

  summaryOfReleasedPRs = mergedPRList.join("\n\n");

  return header + summaryOfReleasedPRs;
};

async function run() {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    const { payload } = github.context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const githubToken = core.getInput("RELEASE_TOKEN");
    const octokit = github.getOctokit(githubToken);

    const lastRelease = await getLastReleaseData(octokit, owner, repo);
    const newReleaseSHA = core.getInput("TARGET_COMMIT_SHA");

    const releasedPRs = await getMergedPRs(
      octokit,
      owner,
      repo,
      lastRelease,
      newReleaseSHA
    );

    const newReleaseDescription = getReleaseSummary(releasedPRs);

    await createNewRelease(
      octokit,
      owner,
      repo,
      lastRelease,
      newReleaseDescription,
      newReleaseSHA
    );

    core.setOutput('CHANGELOG_MESSAGE', newReleaseDescription);

    const newVersion = getNewVersionNumber(lastRelease.tag_name);
    core.setOutput('VERSION', newVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
