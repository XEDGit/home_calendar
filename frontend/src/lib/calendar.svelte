<script>
    import { onMount } from 'svelte';
  
    export let events = [];
  
    let currentDate = new Date();
    let monthDays = [];
    
    onMount(() => {
      generateCalendar(currentDate);
    });
  
    function generateCalendar(date) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      monthDays = [];
      
      // Fill the monthDays array with empty slots for the previous month
      for (let i = 0; i < firstDay.getDay(); i++) {
        monthDays.push(null);
      }
      
      // Add the days of the month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        monthDays.push(new Date(year, month, day));
      }
    }
  
    function getEventsForDate(date) {
      let day_events = events.filter(event => new Date(event.start).toDateString() === date.toDateString());
      return day_events
    }
  </script>
  
  <style>
    .calendar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
      margin: 20px 0;
    }
    
    .day {
      border: 1px solid #ccc;
      padding: 10px;
      position: relative;
      height: 150px;
      background-color: #f9f9f9;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    .day-header {
      font-weight: bold;
      text-align: center;
      margin-bottom: 5px;
    }
    
    .event {
      background-color: #007bff;
      color: white;
      border-radius: 3px;
      padding: 5px;
      margin-top: 5px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
  
    .event:hover {
      background-color: #0056b3;
    }
  </style>
  
  <div>
    <h2>{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</h2>
    <div class="calendar">
      {#each monthDays as day}
        <div class="day">
          {#if day}
            <div class="day-header">{day.getDate()}</div>
            {#each getEventsForDate(day) as event}
              <div class="event">
                {event.title} 
                <br>
                <small>
                  {new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                  {new Date(event.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </small>
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  </div>
  