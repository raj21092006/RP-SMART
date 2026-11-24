
import { useCallback, useEffect, useState } from 'react';

type WeatherData = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  timezone: string;
};

const weatherDescription = (code: number) => {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Weather unavailable';
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState('loading');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  const loadWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('loading');
    setError('');
    setWeather(null);

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude } = position.coords;

          const url = new URL('https://api.open-meteo.com/v1/forecast');

          url.search = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
            timezone: 'auto'
          }).toString();

          const response = await fetch(url.toString());

          if (!response.ok) {
            throw new Error('Weather service is unavailable.');
          }

          const data = await response.json();

          if (!data.current) {
            throw new Error('Weather data is unavailable.');
          }

          const currentLocation = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;

          const weatherContext = {
            temperature: data.current.temperature_2m,
            feelsLike: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
            wind: data.current.wind_speed_10m,
            condition: weatherDescription(data.current.weather_code),
            location: currentLocation,
            timezone: data.timezone,
            updatedAt: new Date().toISOString()
          };

          setWeather({
            temperature: data.current.temperature_2m,
            feelsLike: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
            wind: data.current.wind_speed_10m,
            code: data.current.weather_code,
            timezone: data.timezone
          });

          setLocation(currentLocation);

          // Save live weather context for RP SMART
          localStorage.setItem(
            'rp-smart-weather',
            JSON.stringify(weatherContext)
          );

          setStatus('ready');

        } catch (err) {
          setStatus('error');
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load weather.'
          );
        }
      },

      err => {
        setStatus('error');

        setError(
          err.code === 1
            ? 'Location permission denied. Allow location access and retry.'
            : err.code === 2
              ? 'Your location could not be detected. Please retry.'
              : 'Location request timed out. Please retry.'
        );
      },

      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  return (
    <section className="hud-panel weather-panel">
      <div className="panel-heading">
        <div className="panel-title-stack">
          <span className="panel-icon">☀</span>

          <div>
            <span className="panel-eyebrow">LIVE CONDITIONS</span>
            <h2>Local weather</h2>
          </div>
        </div>

        <button
          className="panel-link"
          onClick={loadWeather}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {status === 'loading' && (
        <p className="weather-message">
          Detecting your location and loading weather...
        </p>
      )}

      {status === 'error' && (
        <div className="weather-message">
          <p>{error}</p>
          <button className="text-action" onClick={loadWeather}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && weather && (
        <>
          <div className="weather-main">
            <strong>{Math.round(weather.temperature)}°C</strong>
            <span>{weatherDescription(weather.code)}</span>
          </div>

          <p className="weather-location">⌖ {location}</p>

          <div className="weather-details">
            <div>
              <span>FEELS LIKE</span>
              <b>{Math.round(weather.feelsLike)}°C</b>
            </div>

            <div>
              <span>HUMIDITY</span>
              <b>{weather.humidity}%</b>
            </div>

            <div>
              <span>WIND</span>
              <b>{weather.wind} km/h</b>
            </div>
          </div>

          <p className="weather-timezone">{weather.timezone}</p>
        </>
      )}

      <span className="panel-corner corner-tl" />
      <span className="panel-corner corner-br" />
    </section>
  );
}
