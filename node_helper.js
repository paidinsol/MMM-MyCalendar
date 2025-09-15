const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "FETCH_EVENTS") {
      console.log("MMM-MyCalendar: Received FETCH_EVENTS request");
      console.log("Calendars to fetch:", payload);
      
      let events = [];
      
      // Only use test events if explicitly no calendars are provided
      if (!payload || payload.length === 0) {
        console.log("No calendars configured in config.js");
        this.sendSocketNotification("EVENTS_RESULT", []);
        return;
      }
      
      for (const cal of payload) {
        try {
          console.log(`Fetching calendar: ${cal.url}`);
          const response = await fetch(cal.url);
          
          if (!response.ok) {
            console.error(`HTTP error! status: ${response.status} for ${cal.url}`);
            continue;
          }
          
          const data = await response.text();
          console.log(`Received data length: ${data.length} from ${cal.url}`);
          
          if (data.length === 0) {
            console.warn(`Empty response from ${cal.url}`);
            continue;
          }
          
          const parsed = ical.parseICS(data);
          const eventKeys = Object.keys(parsed).filter(k => parsed[k].type === 'VEVENT');
          console.log(`Found ${eventKeys.length} events in ${cal.url}`);
          
          for (let k in parsed) {
            const ev = parsed[k];
            if (ev.type === "VEVENT") {
              const event = {
                summary: ev.summary || "Untitled Event",
                start: ev.start,
                end: ev.end,
                description: ev.description || "",
                location: ev.location || "",
                color: cal.color || "#ffffff",
                symbol: cal.symbol || "calendar",
                fullDayEvent: this.isFullDayEvent(ev)
              };
              events.push(event);
              console.log(`Added event: ${event.summary} at ${event.start}`);
            }
          }
        } catch (err) {
          console.error(`Error fetching calendar ${cal.url}:`, err.message);
          console.error("Full error:", err);
        }
      }
      
      console.log(`Total events fetched from all calendars: ${events.length}`);
      
      // Send the actual events (even if empty)
      this.sendSocketNotification("EVENTS_RESULT", events);
    }
  },

  isFullDayEvent: function(event) {
    if (!event.end) return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = end - start;
    return duration >= 24 * 60 * 60 * 1000;
  }
});