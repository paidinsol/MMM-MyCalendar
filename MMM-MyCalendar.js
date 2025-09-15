Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maximumEntries: 10,
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
    coloredSymbolOnly: false
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

    let events = this.events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= today && eventDate <= future;
    });

    events = events.slice(0, this.config.maximumEntries);

    if (events.length === 0) {
      wrapper.innerHTML = "No upcoming events.";
      wrapper.className = "calendar dimmed";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "small";

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
    const now = moment();
    const eventTime = moment(event.start);
    
    if (event.fullDayEvent) {
      if (eventTime.isSame(now, "day")) {
        return "Today";
      } else if (eventTime.isSame(moment().add(1, "day"), "day")) {
        return "Tomorrow";
      } else if (eventTime.isSame(now, "week")) {
        return eventTime.format("dddd");
      } else {
        return eventTime.format(this.config.fullDayEventDateFormat);
      }
    }

    if (this.config.timeFormat === "relative") {
      return eventTime.fromNow();
    } else {
      return eventTime.format(this.config.timeFormat);
    }
  },

  capFirst: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  isFullDayEvent: function(event) {
    if (event.start.length === 8 || event.start.indexOf("T") === -1) {
      return true;
    }

    const start = moment(event.start);
    const end = moment(event.end);

    if (end.diff(start, "hours") < 8 && end.diff(start, "days") < 1) {
      return false;
    }

    if (start.hours() !== 0 || start.minutes() !== 0 || start.seconds() !== 0) {
      return false;
    }

    if (end.hours() !== 0 || end.minutes() !== 0 || end.seconds() !== 0) {
      return false;
    }

    return true;
  }
});