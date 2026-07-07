"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox relative inline-block h-4 w-4 shrink-0 rounded-[3px] border border-input ring-offset-background transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 aria-invalid:focus-visible:ring-destructive/50 data-checked:bg-primary data-checked:border-primary data-checked:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:aria-invalid:focus-visible:ring-destructive/50 dark:border-input dark:bg-input/30 dark:checked:bg-primary dark:checked:border-primary dark:checked:text-primary-foreground dark:data-disabled:cursor-not-allowed dark:data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none">
          <path d="M10.5 3L4.5 9L1.5 6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }