/**
 * If you are updating this file you have to rebuild dist/index.js
 * Run following commands to create a new build:
 *   meteor npm install --no-save @actions/core @actions/github @vercel/ncc axios slackify-markdown
 *   cd .github/actions/slack
 *   meteor npx ncc build ./index.js
 * Include rebuilt dist/index.js in the commit
 *
 * -- details on this requirement: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github
 */

const core = require('@actions/core');
const axios = require('axios');
const slackifyMarkdown = require('slackify-markdown');

async function run() {
  try {
    const slackWebhook = process.env.SLACK_WEBHOOK;
    const changelogMessage = core.getInput('CHANGELOG_MESSAGE');
    const version = core.getInput('VERSION');
    const releaseUrl = core.getInput('RELEASE_URL');

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            emoji: true,
            text: `New release v${version} :rocket:`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hey Maestros! See what brings in a new release :magic_wand: \n<${releaseUrl}>`,
          },
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Changelog',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: slackifyMarkdown(changelogMessage),
          },
        },
      ],
    };

    await axios.post(slackWebhook, payload);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
 