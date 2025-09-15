Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    instanceId: "basicCalendar",
    locale: null,
    startDayIndex: 0,
    endDayIndex: 10,
    calendarSet: [],
    firstDayOfWeek: 1,
    minimalDaysOfNewYear: 4,
    cellDateOptions: { month: 'short', day: 'numeric' },
    eventTimeOptions: { timeStyle: 'short' },
    fontSize: '14px',
    eventHeight: '20px',
    maxEventLines: 5,
    animationSpeed: 1000,
    waitFetch: 5000,
    refreshInterval: 600000,
    useSymbol: true,
    useIconify: false,
    weekends: null,
    eventFilter: null,
    eventSorter: null,
    eventTransformer: null,
    preProcessor: null
  },

  getStyles: function() {
    return ["MMM-MyCalendar.css"];
  },

  getScripts: function() {
    return [];
  },

  start: function () {
    Log.info(`Starting module: ${this.name}`);
    this.events = [];
    this.config.locale = this.config.locale || config.language;
    this.config.instanceId = this.config.instanceId || this.identifier;
    this.sendSocketNotification("INIT", this.config);
    this.getData();
    this.scheduleUpdate();
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getData();
    }, this.config.updateInterval);
  },

  getData: function () {
    this.sendSocketNotification("FETCH_EVENTS", {
      calendars: this.config.calendars,
      instanceId: this.config.instanceId
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EVENTS_RESULT" && payload.instanceId === this.config.instanceId) {
      this.events = this.processEvents(payload.events);
      this.updateDom(this.config.animationSpeed);
    }
  },

  processEvents: function(events) {
    let processedEvents = events;
    
    // Apply pre-processor
    if (this.config.preProcessor && typeof this.config.preProcessor === 'function') {
      processedEvents = this.config.preProcessor(processedEvents);
    }
    
    // Filter events by calendar set
    if (this.config.calendarSet && this.config.calendarSet.length > 0) {
      processedEvents = processedEvents.filter(event => 
        this.config.calendarSet.includes(event.calendarName)
      );
    }
    
    // Apply custom filter
    if (this.config.eventFilter && typeof this.config.eventFilter === 'function') {
      processedEvents = processedEvents.filter(this.config.eventFilter);
    }
    
    // Apply custom sorter
    if (this.config.eventSorter && typeof this.config.eventSorter === 'function') {
      processedEvents = processedEvents.sort(this.config.eventSorter);
    } else {
      // Default sorting by start time
      processedEvents = processedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    }
    
    // Apply custom transformer
    if (this.config.eventTransformer && typeof this.config.eventTransformer === 'function') {
      processedEvents = processedEvents.map(this.config.eventTransformer);
    }
    
    return processedEvents;
  },

  filterEventsByDateRange: function(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + this.config.startDayIndex);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + this.config.endDayIndex);
    
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= startDate && eventDate <= endDate;
    });
  },

  formatDate: function(date, options = null) {
    const dateOptions = options || this.config.cellDateOptions;
    const locale = this.config.locale;
    
    const today = new Date();
    const eventDate = new Date(date);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (eventDate.toDateString() === today.toDateString()) {
      return "TODAY";
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return "TOMORROW";
    } else {
      return eventDate.toLocaleDateString(locale, dateOptions).toUpperCase();
    }
  },

  formatTime: function(date, options = null) {
    const timeOptions = options || this.config.eventTimeOptions;
    const locale = this.config.locale;
    return new Date(date).toLocaleTimeString(locale, timeOptions);
  },

  getEventType: function(event) {
    const title = event.summary.toLowerCase();
    if (title.includes('meeting') || title.includes('call') || title.includes('business')) return 'meeting';
    if (title.includes('appointment') || title.includes('doctor')) return 'appointment';
    if (title.includes('reminder') || title.includes('task')) return 'reminder';
    if (title.includes('holiday') || title.includes('vacation')) return 'holiday';
    if (title.includes('project') || title.includes('milestone')) return 'project';
    return 'default';
  },

  isFullDayEvent: function(event) {
    if (!event.end) return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = end - start;
    return duration >= 24 * 60 * 60 * 1000; // 24 hours or more
  },

  groupEventsByDate: function(events) {
    const grouped = {};
    events.forEach(event => {
      const dateKey = new Date(event.start).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: new Date(event.start),
          events: []
        };
      }
      grouped[dateKey].events.push(event);
    });
    
    // Sort events within each date
    Object.keys(grouped).forEach(date => {
      grouped[date].events.sort((a, b) => {
        // Full day events first
        const aFullDay = this.isFullDayEvent(a);
        const bFullDay = this.isFullDayEvent(b);
        if (aFullDay && !bFullDay) return -1;
        if (!aFullDay && bFullDay) return 1;
        // Then by time
        return new Date(a.start) - new Date(b.start);
      });
    });
    
    return grouped;
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "CX3A MMM-MyCalendar";
    wrapper.style.fontSize = this.config.fontSize;
    
    if (!this.events || this.events.length === 0) {
      wrapper.innerHTML = `<div class="noEvents">No upcoming events</div>`;
      return wrapper;
    }

    const filteredEvents = this.filterEventsByDateRange(this.events);
    
    if (filteredEvents.length === 0) {
      wrapper.innerHTML = `<div class="noEvents">No upcoming events</div>`;
      return wrapper;
    }
    
    const groupedEvents = this.groupEventsByDate(filteredEvents);
    
    Object.keys(groupedEvents)
      .sort((a, b) => new Date(a) - new Date(b))
      .forEach(dateKey => {
        const dayGroup = groupedEvents[dateKey];
        const dayCell = this.createDayCell(dayGroup);
        wrapper.appendChild(dayCell);
      });
    
    return wrapper;
  },
  
  createDayCell: function(dayGroup) {
    const cell = document.createElement("div");
    cell.className = "cell";
    
    const cellHeader = document.createElement("div");
    cellHeader.className = "cellHeader";
    
    const cellDate = document.createElement("div");
    cellDate.className = "cellDate";
    cellDate.textContent = this.formatDate(dayGroup.date);
    cellHeader.appendChild(cellDate);
    
    const today = new Date().toDateString();
    if (dayGroup.date.toDateString() === today) {
      cell.classList.add("today");
    }
    
    cell.appendChild(cellHeader);
    
    const cellBody = document.createElement("div");
    cellBody.className = "cellBody";
    
    // Separate full day and timed events
    const fullDayEvents = dayGroup.events.filter(event => this.isFullDayEvent(event));
    const timedEvents = dayGroup.events.filter(event => !this.isFullDayEvent(event));
    
    // Add full day events
    if (fullDayEvents.length > 0) {
      const fullDayContainer = document.createElement("div");
      fullDayContainer.className = "fullday";
      
      fullDayEvents.forEach(event => {
        const eventElement = this.createEventElement(event, true);
        fullDayContainer.appendChild(eventElement);
      });
      
      cellBody.appendChild(fullDayContainer);
    }
    
    // Add timed events
    if (timedEvents.length > 0) {
      const timedContainer = document.createElement("div");
      timedContainer.className = "timed";
      
      timedEvents.forEach(event => {
        const eventElement = this.createEventElement(event, false);
        timedContainer.appendChild(eventElement);
      });
      
      cellBody.appendChild(timedContainer);
    }
    
    cell.appendChild(cellBody);
    return cell;
  },
  
  createEventElement: function(event, isFullDay = false) {
    const eventDiv = document.createElement("div");
    eventDiv.className = `event ${this.getEventType(event)}`;
    eventDiv.style.height = this.config.eventHeight;
    
    if (event.color) {
      eventDiv.style.setProperty('--calendarColor', event.color);
    }
    
    const headline = document.createElement("div");
    headline.className = "headline";
    
    if (!isFullDay) {
      const time = document.createElement("div");
      time.className = "time";
      time.textContent = this.formatTime(event.start);
      headline.appendChild(time);
    }
    
    if (this.config.useSymbol && event.symbol) {
      const symbol = document.createElement("span");
      symbol.className = `symbol fa fa-${event.symbol}`;
      headline.appendChild(symbol);
    }
    
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = event.summary;
    headline.appendChild(title);
    
    eventDiv.appendChild(headline);
    
    if (event.description) {
      const description = document.createElement("div");
      description.className = "description";
      description.textContent = event.description;
      eventDiv.appendChild(description);
    }
    
    return eventDiv;
  }
});