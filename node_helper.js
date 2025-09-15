const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "FETCH_EVENTS") {
      console.log("MMM-MyCalendar: Received FETCH_EVENTS request");
      console.log("Calendars to fetch:", payload);
      
      let events = [];
      
      // If no calendars configured, send test events
      if (!payload || payload.length === 0) {
        console.log("No calendars configured, sending test events");
        events = this.getTestEvents();
        this.sendSocketNotification("EVENTS_RESULT", events);
        return;
      }
      
      for (const cal of payload) {
        try {
          console.log(`Fetching calendar: ${cal.url}`);
          const response = await fetch(cal.url);
          
          if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            continue;
          }
          
          const data = await response.text();
          console.log(`Received data length: ${data.length}`);
          
          const parsed = ical.parseICS(data);
          console.log(`Parsed events count: ${Object.keys(parsed).length}`);
          
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
            }
          }
        } catch (err) {
          console.error(`Error fetching calendar ${cal.url}:`, err.message);
        }
      }
      
      console.log(`Total events fetched: ${events.length}`);
      
      // If no events were fetched, send test events
      if (events.length === 0) {
        console.log("No events fetched, sending test events");
        events = this.getTestEvents();
      }
      
      this.sendSocketNotification("EVENTS_RESULT", events);
    }
  },

  getTestEvents: function() {
    const now = new Date();
    return [
      {
        summary: "Test Meeting",
        start: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        end: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        description: "This is a test event",
        location: "Test Location",
        color: "#4fc3f7",
        symbol: "calendar",
        fullDayEvent: false
      },
      {
        summary: "Tomorrow's Appointment",
        start: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        end: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        description: "Another test event",
        location: "Another Location",
        color: "#ff7043",
        symbol: "calendar",
        fullDayEvent: false
      },
      {
        summary: "Weekend Project",
        start: new Date(now.getTime() + 48 * 60 * 60 * 1000), // Day after tomorrow
        end: new Date(now.getTime() + 49 * 60 * 60 * 1000),
        description: "Weekend work",
        location: "Home",
        color: "#66bb6a",
        symbol: "briefcase",
        fullDayEvent: false
      }
    ];
  },

  isFullDayEvent: function(event) {
    if (!event.end) return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = end - start;
    return duration >= 24 * 60 * 60 * 1000;
  }
});