"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  DayPicker as DayPickerPrimitive,
  type DateRange,
  type DayPickerMultipleProps,
  type DayPickerRangeProps,
  type DayPickerSingleProps,
  type DayPickerProps as DayPickerBaseProps,
  type SelectSingleEventHandler,
  type SelectRangeEventHandler,
  type SelectMultipleEventHandler
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type CalendarBaseProps = {
  className?: string
  classNames?: Record<string, string>
  showOutsideDays?: boolean
}

type SingleCalendarProps = Omit<DayPickerSingleProps, 'mode' | 'classNames'> & {
  mode?: 'single'
} & CalendarBaseProps

type MultipleCalendarProps = Omit<DayPickerMultipleProps, 'mode' | 'classNames'> & {
  mode: 'multiple'
} & CalendarBaseProps

type RangeCalendarProps = Omit<DayPickerRangeProps, 'mode' | 'classNames'> & {
  mode: 'range'
} & CalendarBaseProps

type CalendarProps = SingleCalendarProps | MultipleCalendarProps | RangeCalendarProps

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  mode = 'single',
  ...props
}: CalendarProps) {
  const commonClassNames = {
    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
    month: "space-y-4",
    caption: "flex justify-center pt-1 relative items-center",
    caption_label: "text-sm font-medium",
    nav: "space-x-1 flex items-center",
    nav_button: cn(
      buttonVariants({ variant: "outline" }),
      "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
    ),
    nav_button_previous: "absolute left-1",
    nav_button_next: "absolute right-1",
    table: "w-full border-collapse space-y-1",
    head_row: "flex",
    head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
    row: "flex w-full mt-2",
    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
    day: cn(
      buttonVariants({ variant: "ghost" }),
      "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
    ),
    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    day_today: "bg-accent text-accent-foreground",
    day_outside: "text-muted-foreground opacity-50",
    day_disabled: "text-muted-foreground opacity-50",
    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
    day_hidden: "invisible",
    ...classNames,
  };

  const commonComponents = {
    IconLeft: () => <ChevronLeft className="h-4 w-4" />,
    IconRight: () => <ChevronRight className="h-4 w-4" />,
  };

  const commonProps = {
    showOutsideDays,
    className: cn("p-3", className),
    classNames: commonClassNames,
    components: commonComponents,
  };

  return (
    <div className={cn("p-3", className)}>
      {(() => {
        // Type assertion to handle the mode prop
        const DayPickerComponent = DayPickerPrimitive as any;
        return (
          <DayPickerComponent
            {...commonProps}
            {...props}
            mode={mode}
          />
        );
      })()}
    </div>
  );
}

Calendar.displayName = "Calendar"

export { Calendar }
export type { 
  DayPickerSingleProps, 
  DayPickerBaseProps as DayPickerProps, 
  DateRange,
  SelectSingleEventHandler,
  SelectRangeEventHandler,
  SelectMultipleEventHandler
}
