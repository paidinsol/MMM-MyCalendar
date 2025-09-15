const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "FETCH_EVENTS") {
      let events = [];
      let statusInfo = {
        totalCalendars: payload?.length || 0,
        successfulCalendars: 0,
        failedCalendars: 0,
        errors: []
      };
      
      if (!payload || payload.length === 0) {
        this.sendSocketNotification("EVENTS_RESULT", {
          events: [],
          status: "No calendars configured in config.js"
        });
        return;
      }
      
      for (let i = 0; i < payload.length; i++) {
        const cal = payload[i];
        try {
          const response = await fetch(cal.url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'MagicMirror/1.0'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.text();
          
          if (data.length === 0) {
            throw new Error("Empty response");
          }
          
          if (!data.includes('BEGIN:VCALENDAR')) {
            throw new Error("Invalid iCal format");
          }
          
          const parsed = ical.parseICS(data);
          let calendarEvents = 0;
          
          for (let k in parsed) {
            const ev = parsed[k];
            if (ev.type === "VEVENT" && ev.summary && ev.start) {
              const event = {
                summary: ev.summary,
                start: ev.start,
                end: ev.end,
                description: ev.description || "",
                location: ev.location || "",
                color: cal.color || "#ffffff",
                symbol: cal.symbol || "calendar",
                fullDayEvent: this.isFullDayEvent(ev)
              };
              events.push(event);
              calendarEvents++;
            }
          }
          
          statusInfo.successfulCalendars++;
          
        } catch (err) {
          statusInfo.failedCalendars++;
          statusInfo.errors.push(`Calendar ${i + 1}: ${err.message}`);
        }
      }
      
      this.sendSocketNotification("EVENTS_RESULT", {
        events: events,
        status: `Fetched ${events.length} events from ${statusInfo.successfulCalendars}/${statusInfo.totalCalendars} calendars`,
        errors: statusInfo.errors
      });
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