
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerDefaultProps } from "react-day-picker" // Import DayPickerDefaultProps

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// Extend CalendarProps to include DayPickerDefaultProps for modifiers/styles
export type CalendarProps = React.ComponentProps<typeof DayPicker> & DayPickerDefaultProps;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props // Includes modifiers, modifierStyles etc. from DayPickerDefaultProps
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
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
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          // NOTE: High specificity styles using !important moved to modifiersClassNames below
          // This avoids directly putting !important in utility classes.
          // "aria-selected:!bg-primary aria-selected:!text-primary-foreground", // Moved
        ),
        day_range_end: "day-range-end",
        // Selected style is handled primarily by modifiersClassNames below
        // day_selected: "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground", // Simplified/Moved
        day_selected: "", // Can be empty, styles are now in modifiersClassNames
        // Today style is handled by modifiersClassNames below
        // day_today: "!bg-accent !text-accent-foreground", // Moved
        day_today: "", // Can be empty, styles are now in modifiersClassNames
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30", // Adjusted opacity for outside selected
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        // Add default modifier class names if needed, or rely on inline styles via modifierStyles
        ...classNames,
      }}
      // Use modifiersClassNames for high-specificity overrides
      modifiersClassNames={{
        selected: '!bg-primary !text-primary-foreground', // Force selected styles
        today: '!bg-accent !text-accent-foreground', // Force today styles (will be overridden by selected if also selected)
        // Apply eventDay styles without conflicting background/text colors
        // Use border and font-weight for indication
        eventDay: '!border !border-accent !font-bold',
        ...props.modifiersClassNames, // Merge with any passed modifiersClassNames
      }}
      components={{
        IconLeft: ({ className: iconClassName, ...rest }) => ( // Rename className prop
          <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...rest} />
        ),
        IconRight: ({ className: iconClassName, ...rest }) => ( // Rename className prop
          <ChevronRight className={cn("h-4 w-4", iconClassName)} {...rest} />
        ),
      }}
      {...props} // Pass all other props including modifiers and styles
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

