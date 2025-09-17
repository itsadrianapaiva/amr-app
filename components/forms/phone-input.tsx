import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Minimal MVP list; we can expand later. */
type Country = { iso2: string; name: string; dial: string };
const COUNTRIES: Country[] = [
  { iso2: "PT", name: "Portugal", dial: "351" },
  { iso2: "ES", name: "Spain", dial: "34" },
  { iso2: "FR", name: "France", dial: "33" },
  { iso2: "DE", name: "Germany", dial: "49" },
  { iso2: "GB", name: "United Kingdom", dial: "44" },
  { iso2: "IT", name: "Italy", dial: "39" },
  { iso2: "US", name: "United States", dial: "1" },
];

function digitsOnly(s: string) {
  return s.replace(/\D+/g, "");
}

function buildE164(country: Country, national: string) {
  const n = digitsOnly(national);
  return n ? `+${country.dial}${n}` : "";
}

function parseE164(
  value: string | undefined,
  fallbackIso2: string,
  list: Country[]
) {
  const def = list.find((c) => c.iso2 === fallbackIso2) ?? list[0];
  if (!value || !value.startsWith("+")) return { country: def, national: "" };

  const raw = value.slice(1); // drop '+'
  const match =
    list
      .filter((c) => raw.startsWith(c.dial))
      .sort((a, b) => b.dial.length - a.dial.length)[0] || def;

  const national = raw.startsWith(match.dial)
    ? raw.slice(match.dial.length)
    : raw;
  return { country: match, national };
}

export type PhoneInputValue = string; // E.164 like "+351912345678"

type Props = {
  /** Controlled E.164 value (e.g., "+351912345678"). */
  value?: PhoneInputValue;
  /** Called with E.164 plus parts whenever the value changes. */
  onChange?: (
    e164: PhoneInputValue,
    parts: { country: Country; national: string }
  ) => void;
  /** Default country ISO2 (e.g., "PT"). */
  defaultCountry?: Country["iso2"];
  /** Placeholder for the local number field. */
  placeholder?: string;
  /** Standard input props */
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  countries?: Country[]; // optional override list
};

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = "PT",
  placeholder = "912 345 678",
  id,
  name,
  required,
  disabled,
  className,
  countries,
}: Props) {
  const LIST = countries && countries.length ? countries : COUNTRIES;

  // Initial parse happens once on mount for stable controlled behavior
  const initial = React.useMemo(
    () => parseE164(value, defaultCountry, LIST),
    []
  );
  const [countryIso2, setCountryIso2] = React.useState(initial.country.iso2);
  const [national, setNational] = React.useState(initial.national);

  // Sync if parent updates the controlled value
  React.useEffect(() => {
    if (value == null) return;
    const parsed = parseE164(value, countryIso2, LIST);
    if (parsed.country.iso2 !== countryIso2)
      setCountryIso2(parsed.country.iso2);
    if (parsed.national !== national) setNational(parsed.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = React.useMemo(
    () => LIST.find((c) => c.iso2 === countryIso2) ?? LIST[0],
    [LIST, countryIso2]
  );

  function emit(nextCountry: Country, nextNational: string) {
    const e164 = buildE164(nextCountry, nextNational);
    onChange?.(e164, { country: nextCountry, national: nextNational });
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Select
          value={countryIso2}
          onValueChange={(iso) => {
            const next = LIST.find((c) => c.iso2 === iso)!;
            setCountryIso2(next.iso2);
            emit(next, national);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {LIST.map((c) => (
              <SelectItem key={c.iso2} value={c.iso2}>
                {c.name} (+{c.dial})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={placeholder}
          value={national}
          onChange={(e) => {
            const nextNational = e.target.value;
            setNational(nextNational);
            emit(country, nextNational);
          }}
          required={required}
          disabled={disabled}
          className="flex-1"
        />
      </div>
    </div>
  );
}
