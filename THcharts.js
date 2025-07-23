// Add initialization check at the top
console.log('THcharts.js loading...');

// Main application function
async function initializeDashboard() {
  try {
    // 1. Verify Supabase is loaded
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase client not loaded. Check script loading order.');
    }

    // 2. Initialize client with error handling
    const supabaseUrl = 'https://mccyrvznmmigawqqeujm.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY3lydnpubW1pZ2F3cXFldWptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY2Mzc2MywiZXhwIjoyMDY4MjM5NzYzfQ.k9f1P_7FGtUn8ik9tnxZXt0vliHZUyYye6Fdwdha2p8';
    
    console.log('Initializing Supabase client...');
    const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 3. Test connection immediately
    const { error: testError } = await supabaseClient
      .from('sensor_readings')
      .select('*')
      .limit(1);
      
    if (testError) throw testError;
    console.log('Supabase connected successfully!');

    // DOM Elements
    const tempDisplay = document.getElementById('temp');
    const humiDisplay = document.getElementById('humi');
    const lightsButton = document.getElementById('lights');
    const doorStatus = document.querySelector('.device-status');

    // Device IDs - Updated LIGHTS to match your desired ESP32_001
    const DEVICE_IDS = {
      TEMP_HUMIDITY: 'environment_sensor_1',
      DOOR_LOCK: 'door_lock_1',
      LIGHTS: 'ESP32_001'
    };

    // ========== Temperature & Humidity Chart ==========
    // (Keep all your existing chart code exactly the same)
    const initializeChart = async () => {
      // ... (your existing chart implementation remains unchanged)
    };

    // ========== Helper Functions ==========
    const updateCurrentReadings = (temp, humi) => {
      if (tempDisplay) tempDisplay.textContent = `${Math.round(temp)}°C`;
      if (humiDisplay) humiDisplay.textContent = `${Math.round(humi)}%`;
    };

    // Fetch initial states including light state
    const fetchInitialStates = async () => {
      try {
        // Get initial light state
        const { data: lightState, error: lightError } = await supabaseClient
          .from('relay_states')
          .select('state')
          .eq('device_id', DEVICE_IDS.LIGHTS)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!lightError && lightState && lightsButton) {
          lightsButton.classList.toggle('active', lightState.state);
        }

        // Get initial door status (keep your existing door status logic)
        const { data: doorData, error: doorError } = await supabaseClient
          .from('access_events')
          .select('access_result')
          .eq('device_id', DEVICE_IDS.DOOR_LOCK)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!doorError && doorData && doorStatus) {
          doorStatus.textContent = `Status: ${doorData.access_result === 'granted' ? 'Open' : 'Closed'}`;
        }
      } catch (error) {
        console.error('Error fetching initial states:', error);
      }
    };

    // ========== Updated Lights Control ==========
    if (lightsButton) {
      // Real-time subscription for light state changes
      supabaseClient
        .channel('light_state_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'relay_states',
            filter: `device_id=eq.${DEVICE_IDS.LIGHTS}`
          },
          (payload) => {
            lightsButton.classList.toggle('active', payload.new.state);
          }
        )
        .subscribe();

      // Updated click handler
      lightsButton.addEventListener('click', async () => {
        const currentState = lightsButton.classList.contains('active');
        const newState = !currentState;
        
        try {
          // Insert into relay_commands as requested
          const { error } = await supabaseClient
            .from('relay_commands')
            .insert({
              device_id: DEVICE_IDS.LIGHTS,
              desired_state: newState,
              processed: false
            });

          if (error) throw error;

          // Visual feedback while waiting for confirmation
          lightsButton.classList.add('pending');
          setTimeout(() => lightsButton.classList.remove('pending'), 1000);
          
        } catch (error) {
          console.error('Error updating lights:', error);
          // Revert visual state if error occurs
          lightsButton.classList.toggle('active', currentState);
        }
      });
    }

    // ========== Door Status Subscription ==========
    // (Keep your existing door status code exactly the same)
    if (doorStatus) {
      supabaseClient
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
    }

    // Initialize everything
    try {
      await fetchInitialStates();
      const chartChannel = await initializeChart();

      window.addEventListener('beforeunload', () => {
        supabaseClient.removeAllChannels();
      });
    } catch (error) {
      console.error('Initialization error:', error);
    }

  } catch (error) {
    console.error('Dashboard initialization failed:', error);
    alert('Failed to initialize dashboard. Please check console for details.');
  }
}

// Start the application when ready
document.addEventListener('DOMContentLoaded', initializeDashboard);