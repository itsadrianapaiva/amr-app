import { DateRange, Matcher } from "react-day-picker";
import { DatePicker } from "@/components/date-picker";

type DateRangeInputProps = {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  disabledDays?: Matcher | Matcher[];
  helperText?: string;
};

/**
 * Pure presentational calendar:
 * - No RHF imports or schema knowledge
 * - Container controls value + onChange
 * - Optional helper text for UX hints
 */
export function DateRangeInput({
  value,
  onChange,
  disabledDays,
  helperText,
}: DateRangeInputProps) {
  return (
    <div className="flex flex-col">
      <DatePicker
        date={value}
        onSelectDate={onChange}
        disabledDays={disabledDays}
      />
      {helperText ? (
        <p className="text-xs text-muted-foreground mt-2">{helperText}</p>
      ) : null}
    </div>
  );
}
