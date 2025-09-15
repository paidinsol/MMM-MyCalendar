Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maximumEntries: 15,
    maximumNumberOfDays: 365,
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
    this.getData();
    this.scheduleUpdate();
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getData();
    }, this.config.updateInterval);
  },

  getData: function () {
    this.sendSocketNotification("FETCH_EVENTS", this.config.calendars);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EVENTS_RESULT") {
      this.events = payload;
      this.updateDom();
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "calendar";

    if (!this.events || this.events.length === 0) {
      wrapper.innerHTML = "Loading...";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const future = new Date();
    future.setDate(future.getDate() + this.config.maximumNumberOfDays);

    // Filter events to show only from today onwards
    let events = this.events.filter(event => {
      const eventDate = new Date(event.start);
      // For full day events, include if the event date is today or later
      if (event.fullDayEvent) {
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay >= today && eventDay <= future;
      }
      // For timed events, include if the event time is now or later
      return eventDate >= now && eventDate <= future;
    });

    events = events.slice(0, this.config.maximumEntries);

    if (events.length === 0) {
      wrapper.innerHTML = "No upcoming events.";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "medium";

    events.forEach(event => {
      const eventWrapper = document.createElement("tr");
      eventWrapper.className = "normal";

      if (this.config.colored) {
        eventWrapper.style.cssText = "color:" + event.color;
      }

      const symbolWrapper = document.createElement("td");
      if (this.config.displaySymbol) {
        const symbol = document.createElement("span");
        symbol.className = "fa fa-" + (event.symbol || this.config.defaultSymbol);
        if (this.config.colored && this.config.coloredSymbolOnly) {
          symbol.style.cssText = "color:" + event.color;
        }
        symbolWrapper.appendChild(symbol);
      }
      eventWrapper.appendChild(symbolWrapper);

      const titleWrapper = document.createElement("td");
      titleWrapper.innerHTML = event.summary;
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
    
    if (event.fullDayEvent) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const eventDay = new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate());
      
      if (eventDay.getTime() === today.getTime()) {
        return "Today";
      } else if (eventDay.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
      } else {
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        return eventTime.toLocaleDateString('en-US', options);
      }
    }

    // For timed events, show relative time
    const diffMs = eventTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) {
        return "Now";
      }
      return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
      const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return eventTime.toLocaleDateString('en-US', options);
    }
  },

  capFirst: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
});