"use client"

import * as React from "react"
import { Input } from "./input"
import { InputHTMLAttributes } from "react"

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  max?: number
  step?: number | 'any'
  allowEmpty?: boolean
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 'any',
  allowEmpty = true,
  onWheel,
  ...props
}: NumberInputProps) {
  const [inputValue, setInputValue] = React.useState<string>(value === '' ? '' : String(value))
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Update internal state when value prop changes
  React.useEffect(() => {
    setInputValue(value === '' ? '' : String(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    
    // Allow empty string if allowEmpty is true
    if (allowEmpty && rawValue === '') {
      setInputValue('')
      onChange('')
      return
    }

    // Only allow numbers and decimal point
    if (/^\d*\.?\d*$/.test(rawValue)) {
      setInputValue(rawValue)
      
      // Only call onChange if it's a valid number
      const numValue = parseFloat(rawValue)
      if (!isNaN(numValue)) {
        onChange(numValue)
      } else if (allowEmpty) {
        onChange('')
      }
    }
  }

  const handleBlur = () => {
    // Ensure value is within min/max bounds on blur
    if (inputValue === '' && !allowEmpty) {
      const minValue = typeof min === 'number' ? min : 0
      setInputValue(String(minValue))
      onChange(minValue)
      return
    }

    const numValue = parseFloat(inputValue)
    
    if (!isNaN(numValue)) {
      let newValue = numValue
      
      if (typeof min === 'number' && numValue < min) {
        newValue = min
      } else if (typeof max === 'number' && numValue > max) {
        newValue = max
      }
      
      if (newValue !== numValue) {
        setInputValue(String(newValue))
        onChange(newValue)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent number input from changing value on scroll
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      
      const currentValue = parseFloat(inputValue) || 0
      const stepValue = step === 'any' ? 1 : Number(step) || 1
      const newValue = e.key === 'ArrowUp' 
        ? currentValue + stepValue 
        : currentValue - stepValue
      
      // Apply min/max constraints
      let constrainedValue = newValue
      if (typeof min === 'number') {
        constrainedValue = Math.max(constrainedValue, min)
      }
      if (typeof max === 'number') {
        constrainedValue = Math.min(constrainedValue, max)
      }
      
      setInputValue(String(constrainedValue))
      onChange(constrainedValue)
    }
  }

  // Prevent wheel event from changing the value
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (document.activeElement === inputRef.current) {
      e.preventDefault()
    }
    onWheel?.(e)
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
    />
  )
}
