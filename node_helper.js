const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "INIT") {
      console.log("MMM-MyCalendar initialized with config:", payload);
      return;
    }
    
    if (notification === "FETCH_EVENTS") {
      let events = [];
      const calendars = payload.calendars || payload; // Support both old and new structure
      const instanceId = payload.instanceId || "default";
      
      for (const cal of calendars) {
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
                end: ev.end,
                description: ev.description || "",
                location: ev.location || "",
                calendarName: cal.name || "default",
                color: cal.color || "#4fc3f7",
                symbol: cal.symbol || null
              });
            }
          }
        } catch (err) {
          console.error("Error fetching calendar:", cal.url, err);
        }
      }
      
      console.log(`Fetched ${events.length} events for instance ${instanceId}`);
      this.sendSocketNotification("EVENTS_RESULT", {
        events: events,
        instanceId: instanceId
      });
    }
  }
});
