// THcharts.js
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Supabase
  const supabaseUrl = 'YOUR_SUPABASE_URL';
  const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
  const supabase = supabase.createClient(supabaseUrl, supabaseKey);

  // DOM Elements
  const tempDisplay = document.getElementById('temp');
  const humiDisplay = document.getElementById('humi');
  const lightsButton = document.getElementById('lights');
  const doorStatus = document.querySelector('.device-status');

  // Device IDs (replace with your actual device IDs)
  const DEVICE_IDS = {
    TEMP_HUMIDITY: 'environment_sensor_1',
    DOOR_LOCK: 'door_lock_1',
    LIGHTS: 'lights_1'
  };

  // ========== Temperature & Humidity Chart ==========
  const initializeChart = async () => {
    const ctx = document.getElementById('tempHumidityChart').getContext('2d');
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [],
            borderWidth: 1.5,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Humidity (%)',
            data: [],
            borderWidth: 1.5,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            tension: 0.3,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: '#ffffff',
              usePointStyle: true
            }
          }
        },
        scales: {
          x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        }
      }
    });

    // Fetch initial data
    const { data: initialReadings } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('device_id', DEVICE_IDS.TEMP_HUMIDITY)
      .order('created_at', { ascending: false })
      .limit(20);

    if (initialReadings) {
      initialReadings.reverse().forEach(reading => {
        const time = new Date(reading.created_at).toLocaleTimeString();
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(reading.temperature);
        chart.data.datasets[1].data.push(reading.humidity);
      });
      chart.update();
    }

    // Real-time updates
    const channel = supabase
      .channel('sensor_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `device_id=eq.${DEVICE_IDS.TEMP_HUMIDITY}`
        },
        (payload) => {
          const time = new Date(payload.new.created_at).toLocaleTimeString();
          chart.data.labels.push(time);
          chart.data.datasets[0].data.push(payload.new.temperature);
          chart.data.datasets[1].data.push(payload.new.humidity);
          
          // Keep only last 20 readings
          if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
          }
          
          chart.update();
          updateCurrentReadings(payload.new.temperature, payload.new.humidity);
        }
      )
      .subscribe();

    return channel;
  };

  // ========== Device Controls ==========
  const updateCurrentReadings = (temp, humi) => {
    tempDisplay.textContent = `${Math.round(temp)}°C`;
    humiDisplay.textContent = `${Math.round(humi)}%`;
  };

  // Lights Control
  lightsButton.addEventListener('click', async () => {
    const currentState = lightsButton.classList.toggle('active');
    const newState = currentState ? 'on' : 'off';
    
    // Update relay state in Supabase
    const { error } = await supabase
      .from('relay_states')
      .insert({
        device_id: DEVICE_IDS.LIGHTS,
        state: currentState,
        changed_by: 'user'
      });

    if (error) {
      console.error('Error updating lights:', error);
      lightsButton.classList.toggle('active'); // Revert if error
    }
  });

  // Door Status Subscription
  supabase
    .channel('door_status')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'access_events',
        filter: `device_id=eq.${DEVICE_IDS.DOOR_LOCK}`
      },
      (payload) => {
        doorStatus.textContent = `Status: ${payload.new.access_result === 'granted' ? 'Open' : 'Closed'}`;
      }
    )
    .subscribe();

  // Initial device states
  const fetchInitialStates = async () => {
    // Get latest light state
    const { data: lightState } = await supabase
      .from('relay_states')
      .select('state')
      .eq('device_id', DEVICE_IDS.LIGHTS)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lightState?.state) {
      lightsButton.classList.add('active');
    }

    // Get latest door status
    const { data: doorEvent } = await supabase
      .from('access_events')
      .select('access_result')
      .eq('device_id', DEVICE_IDS.DOOR_LOCK)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (doorEvent) {
      doorStatus.textContent = `Status: ${doorEvent.access_result === 'granted' ? 'Open' : 'Closed'}`;
    }
  };

  // Initialize everything
  await fetchInitialStates();
  const chartChannel = await initializeChart();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    supabase.removeChannel(chartChannel);
  });
});