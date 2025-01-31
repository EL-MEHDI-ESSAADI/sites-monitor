// index.mjs
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// Configuration from environment variables
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
const sitesToMonitor = process.env.SITES_TO_MONITOR?.split(",") || [];
// default 5 minutes
const checkInterval =
  parseInt(process.env.CHECK_INTERVAL_IN_SECONDS || "300") * 1000; // Convert to milliseconds

// Validate required environment variables
if (!slackWebhookUrl) {
  throw new Error("SLACK_WEBHOOK_URL environment variable is required");
}

if (!sitesToMonitor.length) {
  throw new Error("SITES_TO_MONITOR environment variable is required");
}

// Initialize sites status
const sitesStatus = new Map(sitesToMonitor.map((site) => [site, false]));

// Function to check the status of a site
async function checkSite(url) {
  try {
    const response = await fetch(url, { timeout: 10000 });
    return response.status === 200;
  } catch (error) {
    console.error(`Error checking ${url}:`, error.message);
    return false;
  }
}

// Function to send a Slack notification
async function sendSlackNotification(site, isDown) {
  const status = isDown ? "DOWN ⛔" : "BACK UP ✅";
  const message = {
    text: `🚨 Site Status Alert 🚨\nSite: ${site}\nStatus: ${status}\nTime: ${new Date().toISOString()}`,
  };

  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error(`Failed to send Slack notification: ${response.status}`);
    } else {
      console.log(`Sent Slack notification for ${site}`);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error.message);
  }
}

// Function to monitor sites
async function monitorSites() {
  console.log("Starting site monitoring...");
  console.log("Monitoring sites:", sitesToMonitor.join(", "));

  while (true) {
    for (const site of sitesToMonitor) {
      console.log(`Checking status for ${site}...`);
      const currentStatus = await checkSite(site);
      const previousStatus = sitesStatus.get(site);

      console.log("finished checking status for ", site);
      console.log(`Current status for ${site}: ${currentStatus}`);
      console.log(`Previous status for ${site}: ${previousStatus}`);

      // If status has changed, send notification
      console.log(
        currentStatus !== previousStatus
          ? `Status changed for ${site}, sending notification`
          : `Status did not change for ${site}, abort sending notification`
      );
      if (currentStatus !== previousStatus) {
        await sendSlackNotification(site, !currentStatus);
        sitesStatus.set(site, currentStatus);

        if (currentStatus) {
          console.log(`Site ${site} is back up`);
        } else {
          console.error(`Site ${site} is down`);
        }
      }
    }

    // Wait for the specified interval
    console.log("Waiting for ", checkInterval, " seconds to check again");
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
    console.log("------------------------------------------------------------");
  }
}

// Start monitoring
monitorSites().catch((error) => {
  console.error("Monitoring error:", error);
  process.exit(1);
});
