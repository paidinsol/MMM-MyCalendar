Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maximumEntries: 25, // Increased to show more events for the week
    maximumNumberOfDays: 7,
    displaySymbol: true,
    defaultSymbol: "calendar",
    showLocation: false,
    displayRepeatingCountTitle: false,
    dateFormat: "MMM Do",
    fullDayEventDateFormat: "MMM Do",
    timeFormat: "relative",
    getRelative: 6,
    urgency: 7,
    broadcastEvents: true,
    hidePrivate: false,
    hideOngoing: false,
    colored: false,
    coloredSymbolOnly: false,
    showPastEvents: false
  },

  getStyles: function() {
    return ["MMM-MyCalendar.css"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.events = [];
    this.loaded = false;
    this.getData();
    this.scheduleUpdate();
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getData();
    }, this.config.updateInterval);
  },

  getData: function () {
    Log.info("MMM-MyCalendar: Requesting calendar data");
    this.sendSocketNotification("FETCH_EVENTS", this.config.calendars);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EVENTS_RESULT") {
      Log.info("MMM-MyCalendar: Received", payload.length, "events");
      this.events = payload;
      this.loaded = true;
      this.updateDom();
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "calendar";

    if (!this.loaded) {
      wrapper.innerHTML = "Loading calendar...";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    if (!this.events || this.events.length === 0) {
      wrapper.innerHTML = "No events available.";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999); // End of the 7th day

    // Filter events: show events from now until end of the week (7 days)
    let events = this.events.filter(event => {
      const eventDate = new Date(event.start);
      
      // For all events, check if they fall within the week range
      if (event.fullDayEvent || this.isFullDayEvent(event)) {
        // For full day events, include if the date is today or within the week
        const eventDay = new Date(eventDate);
        eventDay.setHours(0, 0, 0, 0);
        return eventDay >= today && eventDay <= weekEnd;
      } else {
        // For timed events, include if they're in the future within the week
        return eventDate >= now && eventDate <= weekEnd;
      }
    });

    // Sort events chronologically
    events.sort((a, b) => {
      const dateA = new Date(a.start);
      const dateB = new Date(b.start);
      return dateA - dateB;
    });

    // Limit to maximum entries
    events = events.slice(0, this.config.maximumEntries);

    console.log("Week events:", events.map(e => ({
      title: e.summary,
      date: new Date(e.start).toLocaleDateString(),
      time: new Date(e.start).toLocaleTimeString()
    })));

    if (events.length === 0) {
      wrapper.innerHTML = "No events this week.";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "medium";

    events.forEach(event => {
      const eventWrapper = document.createElement("tr");
      eventWrapper.className = "normal";

      if (this.config.colored && event.color) {
        eventWrapper.style.cssText = "color:" + event.color;
      }

      const symbolWrapper = document.createElement("td");
      if (this.config.displaySymbol) {
        const symbol = document.createElement("span");
        symbol.className = "fa fa-" + (event.symbol || this.config.defaultSymbol);
        if (this.config.colored && this.config.coloredSymbolOnly && event.color) {
          symbol.style.cssText = "color:" + event.color;
        }
        symbolWrapper.appendChild(symbol);
      }
      eventWrapper.appendChild(symbolWrapper);

      const titleWrapper = document.createElement("td");
      titleWrapper.innerHTML = event.summary || "Untitled Event";
      titleWrapper.className = "title bright";
      eventWrapper.appendChild(titleWrapper);

      const timeWrapper = document.createElement("td");
      timeWrapper.innerHTML = this.capFirst(this.titleTransform(event.summary, event));
      timeWrapper.className = "time light";
      eventWrapper.appendChild(timeWrapper);

      table.appendChild(eventWrapper);
    });

    wrapper.appendChild(table);
    return wrapper;
  },

  titleTransform: function (title, event) {
    const now = new Date();
    const eventTime = new Date(event.start);
    
    // Check if it's a full day event
    if (event.fullDayEvent || this.isFullDayEvent(event)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const eventDay = new Date(eventTime);
      eventDay.setHours(0, 0, 0, 0);
      
      if (eventDay.getTime() === today.getTime()) {
        return "Today";
      } else if (eventDay.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
      } else {
        // Show day of week for this week
        const options = { weekday: 'long' };
        return eventTime.toLocaleDateString('en-US', options);
      }
    }

    // For timed events, show relative time or day
    const diffMs = eventTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) {
        return "Now";
      }
      return `in ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else {
      // For events more than 24 hours away, show the day of the week
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const eventDay = new Date(eventTime);
      eventDay.setHours(0, 0, 0, 0);
      
      if (eventDay.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
      } else {
        const options = { weekday: 'long' };
        return eventTime.toLocaleDateString('en-US', options);
      }
    }
  },

  isFullDayEvent: function(event) {
    if (!event.end) return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = end - start;
    return duration >= 24 * 60 * 60 * 1000;
  },

  capFirst: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
});