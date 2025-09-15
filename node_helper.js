const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "FETCH_EVENTS") {
      let events = [];
      for (const cal of payload) {
        try {
          const response = await fetch(cal.url);
          const data = await response.text();
          const parsed = ical.parseICS(data);
          for (let k in parsed) {
            const ev = parsed[k];
            if (ev.type === "VEVENT") {
              events.push({
                summary: ev.summary,
                start: ev.start,
                end: ev.end
              });
            }
          }
        } catch (err) {
          console.error("Error fetching calendar:", err);
        }
      }
      this.sendSocketNotification("EVENTS_RESULT", events);
    }
  }
});
