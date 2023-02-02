/**
 * If you are updating this file you have to rebuild dist/index.js
 * Run following commands to create a new build:
 *   meteor npm install --no-save @actions/core @actions/github @vercel/ncc
 *   cd .github/actions/releases
 *   meteor npx ncc build ./index.js
 * Include rebuilt dist/index.js in the commit
 */

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
  const lastRelease = await octokit.rest.repos.getLatestRelease({
    owner,
    repo,
  });

  return lastRelease.data;
};

const createNewRelease = async (
  octokit,
  owner,
  repo,
  releaseNotes,
  newVersion,
  targetCommitSHA
) => {
  const { data: releaseData } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    body: releaseNotes,
    name: `v${newVersion}`,
    tag_name: newVersion,
    target_commitish: targetCommitSHA,
  });

  return releaseData.html_url;
};

const getMergeOrCommitTimestamp = async (octokit, owner, repo, commitSHA) => {
  let timestamp;
  try {
    const prResponse = await octokit.rest.search.issuesAndPullRequests({
      q: `${commitSHA} repo:${owner}/${repo} is:merged`,
    });
    const prData = prResponse.data.items[0];
    timestamp = prData.pull_request.merged_at;
  } catch {
    const commitResponse = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitSHA,
    });
    timestamp = commitResponse.data.commit.committer.date;
  }
  return timestamp;
};

const getMergedPRs = async (
  octokit,
  owner,
  repo,
  lastReleaseSHA,
  newReleaseSHA
) => {
  const lastReleaseTimestamp = await getMergeOrCommitTimestamp(
    octokit,
    owner,
    repo,
    lastReleaseSHA
  );
  const newReleaseTimestamp = await getMergeOrCommitTimestamp(
    octokit,
    owner,
    repo,
    newReleaseSHA
  );

  // github search for ranged values X..Y is inclusive for X and exclusive for Y
  // so we have to increase each timestamp to get correct list of merged PRs for the new release
  const searchStartTime = new Date(
    new Date(lastReleaseTimestamp).getTime() + 1
  ).toISOString();
  const searchEndTime = new Date(
    new Date(newReleaseTimestamp).getTime() + 1
  ).toISOString();

  const q = `repo:${owner}/${repo} merged:${searchStartTime}..${searchEndTime} base:main`;
  const prSearchResults = await octokit.rest.search.issuesAndPullRequests({
    q,
    per_page: 100,
  });
  return prSearchResults.data.items;
};

const getShortcutLinks = (mergedPRs) => {
  const shortcutRegex =
    /(https:\/\/app.shortcut.com\b\/[-a-zA-Z0-9@:%_\+.~#?&=\/\/]*)/g;

  const shortcutLinks = mergedPRs.map(
    (prData) => prData.body?.match(shortcutRegex) || []
  );
  return shortcutLinks.flat();
};

async function run() {
  try {
    const { payload } = github.context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const targetCommitSHA = core.getInput("TARGET_COMMIT_SHA");
    const githubToken = core.getInput("GITHUB_TOKEN");
    const octokit = github.getOctokit(githubToken);

    const lastRelease = await getLastReleaseData(octokit, owner, repo);
    const newVersion = getNewVersionNumber(lastRelease.tag_name);
    const lastReleaseSHA = lastRelease.target_commitish;
    const newReleaseSHA = targetCommitSHA;

    const mergedPRs = await getMergedPRs(
      octokit,
      owner,
      repo,
      lastReleaseSHA,
      newReleaseSHA
    );

    const changelog = mergedPRs.map(
      (pr) => `${pr.title} by @${pr.user.login} in ${pr.html_url}`
    );

    const releaseNotes =
      `## What's Changed\n` +
      changelog.map((logEntry) => "* " + logEntry).join("\n") +
      "\n\n" +
      `**Full Changelog**: https://github.com/adtribute/analytics/compare/${lastRelease.tag_name}...${newVersion}`;

    const releaseURL = await createNewRelease(
      octokit,
      owner,
      repo,
      releaseNotes,
      newVersion,
      targetCommitSHA
    );

    const shortcutLinks = getShortcutLinks(mergedPRs);

    core.exportVariable("SHORTCUT_LINKS", JSON.stringify(shortcutLinks));
    core.exportVariable("CHANGELOG", JSON.stringify(changelog));
    core.exportVariable("VERSION", newVersion);
    core.exportVariable("RELEASE_URL", releaseURL);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
