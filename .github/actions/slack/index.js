const core = require("@actions/core");
const axios = require("axios");

async function run() {
  try {
    const slackWebhook =  process.env.SLACK_WEBHOOK;
    const changelogMessage = core.getInput("CHANGELOG_MESSAGE");
    const version = core.getInput("VERSION");

    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            emoji: true,
            text: `New release v${version} :rocket:`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `@channel Full changelog here <https://github.com/adtribute/analytics/releases/tag/${version}>`
            
          }
        },
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Changelog"
          }
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: changelogMessage
          }
        }
      ]
    };

    await axios.post(slackWebhook, payload);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
