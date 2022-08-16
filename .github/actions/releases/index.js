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

const createNewRelease = async (octokit, owner, repo, targetCommitSHA) => {
  const lastRelease = await getLastReleaseData(octokit, owner, repo);
  const newVersion = getNewVersionNumber(lastRelease.tag_name);
  const { data: releaseData } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    name: `v${newVersion}`,
    tag_name: newVersion,
    target_commitish: targetCommitSHA,
    generate_release_notes: true,
  });
  return {
    version: releaseData.tag_name,
    changelog: releaseData.body,
    url: releaseData.html_url,
  };
};

const getMergedPRs = async (
  octokit,
  owner,
  repo,
  lastRelease,
  newRelease
) => {
  const lastReleaseTime = lastRelease.published_at;
  const newReleaseTime = newRelease.published_at;

  const q = `repo:${owner}/${repo} merged:${lastReleaseTime}..${newReleaseTime} base:main`;
  const prSearchResults = await octokit.rest.search.issuesAndPullRequests({ q, per_page: 100 });

  return prSearchResults.data.items;
};

const getShortcutLinks = (mergedPRs) => {
  const shortcutRegex =
    /(https:\/\/app.shortcut.com\b\/[-a-zA-Z0-9@:%_\+.~#?&=\/\/]*)/g;

  const shortcutLinks = mergedPRs.map(prData => prData.body.match(shortcutRegex) || []);
  return shortcutLinks.flat();
};

async function run() {
  try {
    const { payload } = github.context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const targetCommitSHA = core.getInput("TARGET_COMMIT_SHA");
    const githubToken = core.getInput("RELEASE_TOKEN");
    const octokit = github.getOctokit(githubToken);

    const lastRelease = await getLastReleaseData(octokit, owner, repo);

    const { version, changelog, url } = await createNewRelease(
      octokit,
      owner,
      repo,
      targetCommitSHA
    );

    const newRelease = await getLastReleaseData(octokit, owner, repo);

    const mergedPRs = await getMergedPRs(octokit, owner, repo, lastRelease, newRelease);
    const shortcutLinks = getShortcutLinks(mergedPRs);

    const changelogMessage = `
      ## Released stories
      ${shortcutLinks.map(link => `* ${link}\n`).join('')}
      \n
      ${changelog}
    `;

    core.setOutput("CHANGELOG_MESSAGE", changelogMessage);
    core.setOutput("VERSION", version);
    core.setOutput("RELEASE_URL", url);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
