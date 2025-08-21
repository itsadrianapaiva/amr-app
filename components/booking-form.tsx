"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { DateRange } from "react-day-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, addDays, startOfDay } from "date-fns";

import { SerializableMachine } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { formatCurrency } from "@/lib/utils";

//matches what the server returns for disabled ranges
export type DisabledRangeJSON = { from: string; to: string };

// VALIDATION
// 1) Schema with dateRange inside the form, plus simple field validation
const dateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  // ensure from and to are actually selected
  .refine((r) => !!r.from, {
    message: "Select a start date",
    path: ["from"],
  })
  .refine((r) => !!r.to, {
    message: "Select an end date",
    path: ["to"],
  })
  // checks that to(end) is after from(start)
  .refine((r) => r.from && r.to && r.from <= r.to, {
    message: "End date cannot be before start",
    path: ["to"],
  })
  // ensures at least one rental day is selected
  //NEED TO CHANGE THIS TO EACH MACHINE BC VARIES
  .refine(
    (r) => r.from && r.to && differenceInCalendarDays(r.to, r.from) + 1 >= 1,
    {
      message: "Select at least one rental day",
      path: ["to"],
    }
  );

// Main schema for the entir form
const formSchema = z.object({
  dateRange: dateRangeSchema,
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Please enter a valid email",
  }),
  phone: z
    .string()
    .min(9, { message: "Please enter a valid phone number" })
    .max(20, { message: "Phone number is too long" }),
});

// Automatically creates a type based on the schema.
//If ever change the schema, type updates automatically
type FormValues = z.infer<typeof formSchema>;

type BookingFormProps = {
  machine: Pick<
    SerializableMachine,
    "id" | "dailyRate" | "deposit" | "deliveryCharge"
  >;
  //optional list of disabled date ranges from server
  disabledRangesJSON?: DisabledRangeJSON[];
};

// 2) Tiny presentational component to keep the form lean
function PriceSummary(props: {
  rentalDays: number;
  dailyRate: number;
  deliveryCharge: number;
  deposit: number;
}) {
  const { rentalDays, dailyRate, deliveryCharge, deposit } = props;
  const subtotal = rentalDays * dailyRate;
  const total = subtotal + deliveryCharge;
  return (
    <Card className="bg-muted/50 p-4">
      <h3 className="font-semibold">Price Summary</h3>
      <div className="mt-2 space-y-1 text-sm">
        <p>
          Subtotal ({rentalDays} days): {formatCurrency(subtotal)}
        </p>
        <p>Delivery: {formatCurrency(deliveryCharge)}</p>
        <p className="font-bold">Total: {formatCurrency(total)}</p>
        <p className="text-muted-foreground">
          Deposit due today: {formatCurrency(deposit)}
        </p>
      </div>
    </Card>
  );
}

//COMPONENT LOGIC: STATE, DERIVED VALUES AND SUBMISSION
export function BookingForm({ machine, disabledRangesJSON }: BookingFormProps) {
  // 3) Normalize numeric fields once
  const dailyRate = Number(machine.dailyRate);
  const deliveryCharge = Number(machine.deliveryCharge);
  const deposit = Number(machine.deposit);

  // Earliest allowed start: tomorrow at 00:00 local time
  const minStart = startOfDay(addDays(new Date(), 1));

  // Build a runtime schema that enforces minStart
  const schemaWithMin = formSchema.superRefine((data, ctx) => {
    const from = data.dateRange.from;
    if (from && from < minStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateRange", "from"],
        message: "Start date cannot be today or in the past",
      });
    }
  });

  //Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaWithMin), //key connection between Zod and react-hook-form
    defaultValues: {
      dateRange: { from: undefined, to: undefined },
      name: "",
      email: "",
      phone: "",
    },
    mode: "onChange", // Validate on every change
  });

  // 4) Derive rental days from form state
  // Subscribes to dateRange changes. when user picks new dates, it will re-render
  const dateRange = form.watch("dateRange");
  // Cache the result of rentalDays calculation
  const rentalDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  // 5) Convert server JSON to Date objects for Calendar "disabled" prop
  const serverDisabled = useMemo(
    () =>
      (disabledRangesJSON ?? []).map((r) => ({
        from: new Date(r.from),
        to: new Date(r.to),
      })),
    [disabledRangesJSON]
  );

  // Policy: block today and all past days
  const disabledDays = useMemo(
    () => [{ before: minStart }, ...serverDisabled],
    [minStart, serverDisabled]
  );

  // 6) Submit shape is ready for a Server Action later
  async function onSubmit(values: FormValues) {
    // Replace with a Server Action call
    // await createPendingBooking(values, machine.id)
    console.info("Booking form submitted", {
      ...values,
      machineId: machine.id,
    });
  }

  const isSubmitDisabled =
    !form.formState.isValid ||
    !dateRange?.from ||
    !dateRange?.to ||
    form.formState.isSubmitting;

  //UI AND RENDERING
  return (
    <Card>
      <CardHeader>
        <CardTitle>Book this Machine</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* DATE RANGE */}
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Rental Dates</FormLabel>
                  <FormControl>
                    <DatePicker
                      date={field.value as DateRange | undefined}
                      onSelectDate={field.onChange}
                      disabledDays={disabledDays}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Earliest start is tomorrow. Same-day rentals are not
                    available.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PRICE SUMMARY */}
            {rentalDays > 0 && (
              <PriceSummary
                rentalDays={rentalDays}
                dailyRate={dailyRate}
                deliveryCharge={deliveryCharge}
                deposit={deposit}
              />
            )}

            {/* CUSTOMER DETAILS */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      id="name"
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      autoComplete="email"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="phone">Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Contact phone number"
                      autoComplete="tel"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitDisabled}>
              {form.formState.isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
