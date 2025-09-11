//Controlled component
//It receives its current value (date) from its parent via props
//When the user tries to change the value, it doesn't change anything itself. Instead, it calls a function from its parent (onSelectDate) to ask the parent to make the change.
"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

//Component "contract": A component's props are its API. They define how other components can interact with it.
interface DatePickerProps {
  date: DateRange | undefined;
  onSelectDate: (date: DateRange | undefined) => void;
  className?: string;
  // Future friendly: pass disabled days when availability logic lands
  disabledDays?: Parameters<typeof Calendar>[0]["disabled"];
}

export function DatePicker({
  date,
  onSelectDate,
  className,
  disabledDays,
}: DatePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            data-testid="date-range-trigger"
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-surface border shadow-md"
          align="start"
        >
          <Calendar
            data-testid="booking-calendar"
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onSelectDate}
            numberOfMonths={2}
            disabled={disabledDays}
            className="rounded-md border bg-card"
            /* Best-practice UX for range pickers */
            modifiersClassNames={{
              // Today: bordered, no fill. When selected, the selected styles below win.
              today: "border-2 border-primary bg-transparent",

              // Selected range: strong fill on ends, softer fill in the middle
              range_start: "bg-primary text-primary-foreground rounded-l-md",
              range_end: "bg-primary text-primary-foreground rounded-r-md",
              range_middle: "bg-primary/20 text-foreground",

              // Disabled: visibly muted and non-interactive
              disabled: "opacity-40 pointer-events-none cursor-not-allowed",
              outside: "text-muted-foreground/60", // days from prev/next month
            }}
            // Keep a11y strong: visible focus ring on keyboard nav
            classNames={{
              day: "h-9 w-9 p-0 aria-selected:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
              day_today: "bg-transparent", // ensure no default fill leaks in
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
