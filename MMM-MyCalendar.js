Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maxEvents: 10,
    showDuration: true,
    groupByDate: true
  },

  getStyles: function() {
    return ["MMM-MyCalendar.css"];
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

  formatDate: function(date) {
    const today = new Date();
    const eventDate = new Date(date);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (eventDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  },

  formatTime: function(date) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  },

  calculateDuration: function(start, end) {
    if (!end) return "";
    const duration = (new Date(end) - new Date(start)) / (1000 * 60);
    if (duration < 60) {
      return `${Math.round(duration)}m`;
    } else {
      const hours = Math.floor(duration / 60);
      const minutes = Math.round(duration % 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  },

  getEventType: function(summary) {
    const title = summary.toLowerCase();
    if (title.includes('meeting') || title.includes('call')) return 'meeting';
    if (title.includes('appointment') || title.includes('doctor')) return 'appointment';
    if (title.includes('reminder') || title.includes('task')) return 'reminder';
    if (title.includes('holiday') || title.includes('vacation')) return 'holiday';
    return 'default';
  },

  groupEventsByDate: function(events) {
    const grouped = {};
    events.forEach(event => {
      const dateKey = new Date(event.start).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    // Sort events within each date by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(a.start) - new Date(b.start));
    });
    
    return grouped;
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "MMM-MyCalendar";
    
    // Add header
    const header = document.createElement("div");
    header.className = "calendar-header";
    const title = document.createElement("h2");
    title.className = "calendar-title";
    title.textContent = "My Agenda";
    header.appendChild(title);
    wrapper.appendChild(header);
    
    if (!this.events || this.events.length === 0) {
      const noEvents = document.createElement("div");
      noEvents.className = "no-events";
      noEvents.textContent = "No upcoming events";
      wrapper.appendChild(noEvents);
      return wrapper;
    }

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "events-container";
    
    // Sort events by date
    const sortedEvents = this.events
      .filter(event => new Date(event.start) >= new Date())
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, this.config.maxEvents);
    
    if (this.config.groupByDate) {
      const groupedEvents = this.groupEventsByDate(sortedEvents);
      const today = new Date().toDateString();
      
      Object.keys(groupedEvents)
        .sort((a, b) => new Date(a) - new Date(b))
        .forEach(dateKey => {
          const dateGroup = document.createElement("div");
          dateGroup.className = "date-group";
          if (dateKey === today) {
            dateGroup.classList.add("today");
          }
          
          const dateHeader = document.createElement("div");
          dateHeader.className = "date-header";
          dateHeader.textContent = this.formatDate(new Date(dateKey));
          dateGroup.appendChild(dateHeader);
          
          groupedEvents[dateKey].forEach(event => {
            const eventItem = this.createEventElement(event);
            dateGroup.appendChild(eventItem);
          });
          
          eventsContainer.appendChild(dateGroup);
        });
    } else {
      sortedEvents.forEach(event => {
        const eventItem = this.createEventElement(event);
        eventsContainer.appendChild(eventItem);
      });
    }
    
    wrapper.appendChild(eventsContainer);
    return wrapper;
  },
  
  createEventElement: function(event) {
    const eventItem = document.createElement("div");
    eventItem.className = `event-item ${this.getEventType(event.summary)}`;
    
    const eventTitle = document.createElement("div");
    eventTitle.className = "event-title";
    eventTitle.textContent = event.summary;
    eventItem.appendChild(eventTitle);
    
    const eventTime = document.createElement("div");
    eventTime.className = "event-time";
    eventTime.textContent = this.formatTime(event.start);
    
    if (this.config.showDuration && event.end) {
      const duration = this.calculateDuration(event.start, event.end);
      if (duration) {
        const durationSpan = document.createElement("span");
        durationSpan.className = "event-duration";
        durationSpan.textContent = duration;
        eventTime.appendChild(durationSpan);
      }
    }
    
    eventItem.appendChild(eventTime);
    return eventItem;
  }
});