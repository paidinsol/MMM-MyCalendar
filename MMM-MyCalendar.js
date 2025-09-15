Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maxEvents: 50,
    groupByDate: true,
    truncateLength: 50
  },

  getStyles: function() {
    return ["MMM-MyCalendar.css"];
  },

  start: function () {
    Log.info("Starting MMM-MyCalendar");
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
    Log.info("Requesting calendar data");
    this.sendSocketNotification("FETCH_EVENTS", this.config.calendars);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EVENTS_RESULT") {
      Log.info("Received", payload.length, "events");
      this.events = payload;
      this.updateDom();
    }
  },

  formatDate: function(date) {
    const today = new Date();
    const eventDate = new Date(date);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (eventDate.toDateString() === today.toDateString()) {
      return "TODAY";
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return "TOMORROW";
    } else if (eventDate.toDateString() === yesterday.toDateString()) {
      return "YESTERDAY";
    } else {
      const options = { weekday: 'long', day: 'numeric', month: 'short' };
      return eventDate.toLocaleDateString('en-US', options).toUpperCase();
    }
  },

  formatTime: function(date) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  getEventType: function(summary) {
    const title = summary.toLowerCase();
    if (title.includes('meeting') || title.includes('call') || title.includes('business')) return 'meeting';
    if (title.includes('appointment') || title.includes('doctor')) return 'appointment';
    if (title.includes('reminder') || title.includes('task')) return 'reminder';
    if (title.includes('holiday') || title.includes('vacation') || title.includes('fullday')) return 'holiday';
    if (title.includes('project') || title.includes('milestone')) return 'project';
    return 'default';
  },

  getEventStatus: function(event) {
    const now = new Date();
    const eventStart = new Date(event.start);
    const eventEnd = event.end ? new Date(event.end) : null;
    
    if (eventEnd && now > eventEnd) {
      return 'passed';
    }
    
    const hour = eventStart.getHours();
    if (hour >= 6 && hour < 12) {
      return 'morning';
    } else if (hour >= 12 && hour < 17) {
      return 'noon';
    } else if (hour >= 17 && hour < 22) {
      return 'evening';
    }
    
    return null;
  },

  isFullDayEvent: function(event) {
    if (!event.end) return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = end - start;
    return duration >= 24 * 60 * 60 * 1000;
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
    
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const aFullDay = this.isFullDayEvent(a);
        const bFullDay = this.isFullDayEvent(b);
        if (aFullDay && !bFullDay) return -1;
        if (!aFullDay && bFullDay) return 1;
        return new Date(a.start) - new Date(b.start);
      });
    });
    
    return grouped;
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "CX3A MMM-MyCalendar";
    
    Log.info("Creating DOM with", this.events.length, "events");
    
    if (!this.events || this.events.length === 0) {
      const noEvents = document.createElement("div");
      noEvents.className = "noEvents";
      noEvents.innerHTML = `
        <div>No events found</div>
        <div style='font-size: 0.8em; margin-top: 10px; opacity: 0.7;'>
          Check browser console (F12) for error messages
        </div>
      `;
      wrapper.appendChild(noEvents);
      return wrapper;
    }

    // Show ALL events without filtering for now
    const sortedEvents = this.events
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, this.config.maxEvents);
    
    Log.info("Displaying", sortedEvents.length, "events");
    
    if (this.config.groupByDate) {
      const groupedEvents = this.groupEventsByDate(sortedEvents);
      const today = new Date().toDateString();
      
      Object.keys(groupedEvents)
        .sort((a, b) => new Date(a) - new Date(b))
        .forEach(dateKey => {
          const dateGroup = document.createElement("div");
          dateGroup.className = "cell";
          if (dateKey === today) {
            dateGroup.classList.add("today");
          }
          
          const dateHeader = document.createElement("div");
          dateHeader.className = "cellHeader";
          
          const dateText = document.createElement("span");
          dateText.className = "cellDate";
          dateText.textContent = this.formatDate(new Date(dateKey));
          dateHeader.appendChild(dateText);
          
          dateGroup.appendChild(dateHeader);
          
          const cellBody = document.createElement("div");
          cellBody.className = "cellBody";
          
          const fullDayEvents = groupedEvents[dateKey].filter(event => this.isFullDayEvent(event));
          const timedEvents = groupedEvents[dateKey].filter(event => !this.isFullDayEvent(event));
          
          if (fullDayEvents.length > 0) {
            const fullDayContainer = document.createElement("div");
            fullDayContainer.className = "fullday";
            
            fullDayEvents.forEach(event => {
              const eventElement = this.createEventElement(event, true);
              fullDayContainer.appendChild(eventElement);
            });
            
            cellBody.appendChild(fullDayContainer);
          }
          
          if (timedEvents.length > 0) {
            const timedContainer = document.createElement("div");
            timedContainer.className = "timed";
            
            timedEvents.forEach(event => {
              const eventElement = this.createEventElement(event, false);
              timedContainer.appendChild(eventElement);
            });
            
            cellBody.appendChild(timedContainer);
          }
          
          dateGroup.appendChild(cellBody);
          wrapper.appendChild(dateGroup);
        });
    }
    
    return wrapper;
  },
  
  createEventElement: function(event, isFullDay = false) {
    const eventItem = document.createElement("div");
    eventItem.className = `event ${this.getEventType(event.summary)}`;
    
    const headline = document.createElement("div");
    headline.className = "headline";
    
    if (!isFullDay) {
      const eventTime = document.createElement("div");
      eventTime.className = "time";
      eventTime.textContent = this.formatTime(event.start);
      headline.appendChild(eventTime);
    }
    
    const eventTitle = document.createElement("div");
    eventTitle.className = "title";
    eventTitle.textContent = event.summary;
    eventTitle.title = event.summary;
    headline.appendChild(eventTitle);
    
    eventItem.appendChild(headline);
    
    const status = this.getEventStatus(event);
    if (status && !isFullDay) {
      const statusSpan = document.createElement("span");
      statusSpan.className = `status ${status}`;
      statusSpan.textContent = status;
      eventItem.appendChild(statusSpan);
    }
    
    return eventItem;
  }
});