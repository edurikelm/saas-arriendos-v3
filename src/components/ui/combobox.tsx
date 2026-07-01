"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon } from "lucide-react"
import { Input } from "./input"

interface ComboboxOption {
  value: string
  label: string
  subtitle?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
  searchPlaceholder?: string
  notFoundMessage?: string
  footerAction?: {
    label: string
    onClick: () => void
  }
  footerDisabledMessage?: string
  showSearch?: boolean
}

function Combobox({
  options,
  value,
  onValueChange,
  className,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  notFoundMessage = "No se encontraron resultados",
  footerAction,
  footerDisabledMessage,
  showSearch = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  const displayOptions = showSearch
    ? options.filter((opt) => {
        const term = search.toLowerCase();
        return (
          opt.label.toLowerCase().includes(term) ||
          (opt.subtitle?.toLowerCase().includes(term) ?? false)
        );
      })
    : options

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearch("")
      setHighlightedIndex(-1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < displayOptions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : displayOptions.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
          onValueChange(displayOptions[highlightedIndex].value)
          setOpen(false)
        }
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        className={cn(
          "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <>
              {selectedOption.label}
              {selectedOption.subtitle && (
                <span className="text-muted-foreground"> ({selectedOption.subtitle})</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground shrink-0" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="center"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 w-(--anchor-width) origin-(--transform-origin) rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            {showSearch && (
              <div className="p-1">
                <Input
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setHighlightedIndex(0)
                  }}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto">
              {displayOptions.length > 0 ? (
                displayOptions.map((opt, index) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    data-highlighted={index === highlightedIndex || undefined}
                    onClick={() => {
                      onValueChange(opt.value)
                      setOpen(false)
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
                      index === highlightedIndex && "bg-accent text-accent-foreground",
                      opt.value === value && "font-medium"
                    )}
                  >
                    <span className="flex flex-1 flex-col">
                      <span>{opt.label}</span>
                      {opt.subtitle && (
                        <span className="text-xs text-muted-foreground">{opt.subtitle}</span>
                      )}
                    </span>
                    {opt.value === value && (
                      <CheckIcon className="pointer-events-none size-4 shrink-0" />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {notFoundMessage}
                </div>
              )}
            </div>
            {footerDisabledMessage && !footerAction && (
              <div className="border-t border-border">
                <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed">
                  {footerDisabledMessage}
                </div>
              </div>
            )}
            {footerAction && !footerDisabledMessage && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    footerAction.onClick()
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {footerAction.label}
                </button>
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { Combobox }
export type { ComboboxOption, ComboboxProps }
