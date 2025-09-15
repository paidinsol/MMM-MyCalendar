Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: []
  },

  start: function () {
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
    if (!this.events || this.events.length === 0) {
      wrapper.innerHTML = "No events found.";
      return wrapper;
    }

    const ul = document.createElement("ul");
    this.events.forEach(event => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${event.summary}</strong> — ${new Date(event.start).toLocaleString()}`;
      ul.appendChild(li);
    });
    wrapper.appendChild(ul);

    return wrapper;
  }
});
