import { useEffect, useRef, useState } from "react";
import { searchBirthCities } from "../../lib/hr/api";
import type { GeocodeSuggestion } from "../../lib/hr/types";

type Props = {
  value: string;
  lat: number | null;
  lng: number | null;
  onChange: (place: string, lat: number | null, lng: number | null) => void;
  required?: boolean;
};

export default function BirthPlaceField({ value, lat, lng, onChange, required }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const results = await searchBirthCities(query.trim());
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const pick = (s: GeocodeSuggestion) => {
    setQuery(s.label);
    onChange(s.label, s.lat, s.lng);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="hr-field">
      <label>
        Город рождения {required && "*"}
        {lat !== null && lng !== null && (
          <span style={{ marginLeft: 8, color: "var(--hr-green)", fontSize: 12 }}>
            ✓ координаты
          </span>
        )}
      </label>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value, null, null);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Начните вводить город"
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="hr-geocode-list">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && lat === null && (
        <p className="hr-error" style={{ marginTop: 6, fontSize: 13 }}>
          Выберите город из списка подсказок для получения координат.
        </p>
      )}
    </div>
  );
}
