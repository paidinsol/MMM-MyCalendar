Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maximumEntries: 20, // Reduced from 50 to keep it smaller
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
    showPastEvents: false,
    showDebugInfo: true
  },

  getStyles: function() {
    return ["MMM-MyCalendar.css"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.events = [];
    this.loaded = false;
    this.status = "Initializing...";
    this.errors = [];
    this.lastUpdate = null;
    this.getData();
    this.scheduleUpdate();
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getData();
    }, this.config.updateInterval);
  },

  getData: function () {
    this.status = "Fetching calendars...";
    this.updateDom();
    this.sendSocketNotification("FETCH_EVENTS", this.config.calendars);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EVENTS_RESULT") {
      this.events = payload.events || [];
      this.status = payload.status || "Unknown status";
      this.errors = payload.errors || [];
      this.loaded = true;
      this.lastUpdate = new Date();
      this.updateDom();
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "calendar";

    // Show compact debug info
    if (this.config.showDebugInfo) {
      const debugInfo = document.createElement("div");
      debugInfo.className = "debug-info";
      
      let debugText = `${this.status}`;
      if (this.events.length > 0) {
        debugText += ` | ${this.events.length} events`;
      }
      if (this.errors.length > 0) {
        debugText += ` | ${this.errors.length} errors`;
      }
      
      debugInfo.innerHTML = debugText;
      wrapper.appendChild(debugInfo);
      
      // Show errors if any (compact)
      if (this.errors.length > 0) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-info";
        errorDiv.innerHTML = this.errors.slice(0, 2).join('<br>'); // Show max 2 errors
        wrapper.appendChild(errorDiv);
      }
    }

    if (!this.loaded) {
      const loading = document.createElement("div");
      loading.innerHTML = this.status;
      loading.className = "calendar dimmed";
      wrapper.appendChild(loading);
      return wrapper;
    }

    if (!this.events || this.events.length === 0) {
      const noEvents = document.createElement("div");
      noEvents.innerHTML = "No events";
      noEvents.className = "calendar dimmed";
      wrapper.appendChild(noEvents);
      return wrapper;
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Back to 1 week for smaller display
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7); // Back to 1 week
    weekEnd.setHours(23, 59, 59, 999);

    // Filter events for the week
    let events = this.events.filter(event => {
      const eventDate = new Date(event.start);
      
      if (event.fullDayEvent || this.isFullDayEvent(event)) {
        const eventDay = new Date(eventDate);
        eventDay.setHours(0, 0, 0, 0);
        return eventDay >= today && eventDay <= weekEnd;
      } else {
        return eventDate >= now && eventDate <= weekEnd;
      }
    });

    // Sort events chronologically
    events.sort((a, b) => {
      const dateA = new Date(a.start);
      const dateB = new Date(b.start);
      return dateA - dateB;
    });

    events = events.slice(0, this.config.maximumEntries);

    if (events.length === 0) {
      const noWeekEvents = document.createElement("div");
      noWeekEvents.innerHTML = "No events this week";
      noWeekEvents.className = "calendar dimmed";
      wrapper.appendChild(noWeekEvents);
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
    
    if (event.fullDayEvent || this.isFullDayEvent(event)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const eventDay = new Date(eventTime);
      eventDay.setHours(0, 0, 0, 0);
      
      if (eventDay.getTime() === today.getTime()) {
        return "Today";
      } else if (eventDay.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
      } else {
        const options = { weekday: 'short' }; // Shorter day names
        return eventTime.toLocaleDateString('en-US', options);
      }
    }

    const diffMs = eventTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) {
        return "Now";
      }
      return `${diffMinutes}m`; // Shorter format
    } else if (diffHours < 24) {
      return `${diffHours}h`; // Shorter format
    } else {
      const options = { weekday: 'short' }; // Shorter day names
      return eventTime.toLocaleDateString('en-US', options);
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