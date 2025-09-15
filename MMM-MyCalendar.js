Module.register("MMM-MyCalendar", {
  defaults: {
    updateInterval: 15 * 60 * 1000,
    calendars: [],
    maxEvents: 20,
    showWeather: true,
    groupByDate: true,
    showPastEvents: false,
    compactMode: true,
    truncateLength: 35
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
      return "TODAY";
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return "TOMORROW";
    } else {
      const options = { weekday: 'short', day: 'numeric', month: 'short' };
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

  truncateText: function(text, maxLength) {
    if (!this.config.compactMode || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
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
    
    const title = event.summary.toLowerCase();
    if (title.includes('overday') || title.includes('all day')) {
      return 'overday';
    }
    
    return null;
  },

  getWeatherInfo: function(date) {
    const weatherData = {
      'TODAY': { temp: '33°', low: '26°', icon: '☀️' },
      'TOMORROW': { temp: '32°', low: '23°', icon: '☁️' },
      'default': { temp: '30°', low: '21°', icon: '🌤️' }
    };
    
    const dateKey = this.formatDate(date);
    return weatherData[dateKey] || weatherData['default'];
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
      grouped[date].sort((a, b) => new Date(a.start) - new Date(b.start));
    });
    
    return grouped;
  },

  filterFutureEvents: function(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= today;
    });
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "MMM-MyCalendar";
    
    const header = document.createElement("div");
    header.className = "calendar-header";
    const title = document.createElement("h2");
    title.className = "calendar-title";
    title.textContent = "MY AGENDA";
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
    
    const futureEvents = this.filterFutureEvents(this.events);
    const sortedEvents = futureEvents
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, this.config.maxEvents);
    
    if (sortedEvents.length === 0) {
      const noEvents = document.createElement("div");
      noEvents.className = "no-events";
      noEvents.textContent = "No upcoming events";
      wrapper.appendChild(noEvents);
      return wrapper;
    }
    
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
          
          const dateText = document.createElement("span");
          dateText.className = "date-text";
          dateText.textContent = this.formatDate(new Date(dateKey));
          dateHeader.appendChild(dateText);
          
          if (this.config.showWeather) {
            const weather = this.getWeatherInfo(new Date(dateKey));
            const weatherInfo = document.createElement("div");
            weatherInfo.className = "weather-info";
            
            const tempSpan = document.createElement("span");
            tempSpan.className = "weather-temp";
            tempSpan.textContent = `${weather.temp} ${weather.low}`;
            
            const iconSpan = document.createElement("span");
            iconSpan.className = "weather-icon";
            iconSpan.textContent = weather.icon;
            
            weatherInfo.appendChild(tempSpan);
            weatherInfo.appendChild(iconSpan);
            dateHeader.appendChild(weatherInfo);
          }
          
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
    
    const indicator = document.createElement("div");
    indicator.className = "event-indicator";
    eventItem.appendChild(indicator);
    
    const content = document.createElement("div");
    content.className = "event-content";
    
    const details = document.createElement("div");
    details.className = "event-details";
    
    const eventTime = document.createElement("div");
    eventTime.className = "event-time";
    eventTime.textContent = this.formatTime(event.start);
    details.appendChild(eventTime);
    
    const eventTitle = document.createElement("div");
    eventTitle.className = "event-title";
    eventTitle.textContent = this.truncateText(event.summary, this.config.truncateLength);
    eventTitle.title = event.summary; // Show full text on hover
    details.appendChild(eventTitle);
    
    content.appendChild(details);
    
    const status = this.getEventStatus(event);
    if (status) {
      const statusSpan = document.createElement("span");
      statusSpan.className = `event-status ${status}`;
      statusSpan.textContent = status;
      content.appendChild(statusSpan);
    }
    
    eventItem.appendChild(content);
    return eventItem;
  }
});