/**
 * If you are updating this file you have to rebuild dist/index.js
 * Run following commands to create a new build:
 *   meteor npm install --no-save @actions/core @actions/github @vercel/ncc axios
 *   cd .github/actions/slack
 *   meteor npx ncc build ./index.js
 * Include rebuilt dist/index.js in the commit
 *
 * -- details on this requirement: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github
 */

const core = require('@actions/core');
const axios = require('axios');

function createSlackTextSection(text) {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  };
}

function createSlackPayload({ version, releaseUrl, shortcutLinks, changelog }) {
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
          text: 'Released stories',
        },
      },
    ],
  };

  if (shortcutLinks.length) {
    shortcutLinks.forEach(link => {
      const textSection = createSlackTextSection(`• ${link}`);
      payload.blocks.push(textSection);
    });
  } else {
    const textSection = createSlackTextSection('None 🤷‍♀️ 🤷‍♂️');
    payload.blocks.push(textSection);
  }

  payload.blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Changelog',
    },
  });

  if (changelog.length) {
    changelog.forEach(logEntry => {
      const textSection = createSlackTextSection(`• ${logEntry}`);
      payload.blocks.push(textSection);
    });
  } else {
    const textSection = createSlackTextSection('None 🤷‍♂️ 🤷‍♀️');
    payload.blocks.push(textSection);
  }

  payload.blocks.push({ type: 'divider' });

  return payload;
}

async function run() {
  try {
    const slackWebhook = process.env.SLACK_WEBHOOK;
    const shortcutLinks = JSON.parse(process.env.SHORTCUT_LINKS);
    const changelog = JSON.parse(process.env.CHANGELOG);
    const version = process.env.VERSION;
    const releaseUrl = process.env.RELEASE_URL;

    const payload = createSlackPayload({ version, releaseUrl, shortcutLinks, changelog });

    await axios.post(slackWebhook, payload);
  } catch (error) {
    core.setFailed(error.message);
    console.error(error);
  }
}

run();
 