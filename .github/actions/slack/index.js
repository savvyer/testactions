const core = require("@actions/core");
const axios = require("axios");

async function slackSend(slackWebhook, changelogMessage) {
  try {
    const payload = {
      text: changelogMessage
    };

    await axios.post(slackWebhook, payload);

  } catch (error) {
    core.setFailed(error);
  }
};

async function run() {
  try {
    const slackWebhook = core.getInput("SLACK_WEBHOOK");
    if (slackWebhook === undefined) {
      throw new Error('Need to provide SLACK_WEBHOOK');
    }

    const changelogMessage = core.getInput("CHANGELOG_MESSAGE");
    if (changelogMessage === undefined) {
      throw new Error('Need to provide CHANGELOG_MESSAGE');
    }

    slackSend(slackWebhook, changelogMessage);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
