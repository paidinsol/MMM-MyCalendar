const NodeHelper = require("node_helper");
const ical = require("node-ical");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = NodeHelper.create({
  socketNotificationReceived: async function (notification, payload) {
    if (notification === "FETCH_EVENTS") {
      console.log("MMM-MyCalendar: Starting calendar fetch");
      console.log("Calendars configured:", payload?.length || 0);
      
      let events = [];
      let fetchErrors = [];
      
      if (!payload || payload.length === 0) {
        console.log("No calendars configured");
        this.sendSocketNotification("EVENTS_RESULT", []);
        return;
      }
      
      for (let i = 0; i < payload.length; i++) {
        const cal = payload[i];
        try {
          console.log(`Fetching calendar ${i + 1}/${payload.length}: ${cal.url}`);
          
          // Add timeout to fetch
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(cal.url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'MagicMirror Calendar Module'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.text();
          console.log(`Calendar ${i + 1} data length: ${data.length} characters`);
          
          if (data.length === 0) {
            console.warn(`Calendar ${i + 1} returned empty data`);
            continue;
          }
          
          // Check if data looks like iCal format
          if (!data.includes('BEGIN:VCALENDAR') && !data.includes('BEGIN:VEVENT')) {
            console.warn(`Calendar ${i + 1} doesn't appear to be valid iCal format`);
            console.log(`First 200 chars: ${data.substring(0, 200)}`);
            continue;
          }
          
          const parsed = ical.parseICS(data);
          const eventKeys = Object.keys(parsed).filter(k => parsed[k].type === 'VEVENT');
          console.log(`Calendar ${i + 1} parsed ${eventKeys.length} events`);
          
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
            }
          }
          
          console.log(`Calendar ${i + 1} contributed ${eventKeys.length} events`);
          
        } catch (err) {
          const errorMsg = `Calendar ${i + 1} (${cal.url}): ${err.message}`;
          console.error(errorMsg);
          fetchErrors.push(errorMsg);
          
          if (err.name === 'AbortError') {
            console.error(`Calendar ${i + 1} timed out after 10 seconds`);
          }
        }
      }
      
      console.log(`Total events fetched: ${events.length}`);
      if (fetchErrors.length > 0) {
        console.log(`Fetch errors: ${fetchErrors.length}`);
        fetchErrors.forEach(error => console.error(error));
      }
      
      // Send results even if some calendars failed
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