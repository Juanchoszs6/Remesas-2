"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export interface AutocompleteOption {
  codigo: string
  nombre: string
  precio_base?: number
  tiene_iva?: boolean
}

interface AutocompleteProps {
  label: string
  placeholder: string
  apiEndpoint: string
  value: string
  onSelect: (option: AutocompleteOption) => void
  onInputChange?: (value: string) => void // callback for manual input changes
  required?: boolean
  readOnlyInput?: boolean // disables manual typing, only allows dropdown selection
  disabled?: boolean // disables the entire input field
}

export function Autocomplete({
  label,
  placeholder,
  apiEndpoint,
  value,
  onSelect,
  onInputChange,
  required,
  readOnlyInput = false,
  disabled = false
}: AutocompleteProps) {
  const [query, setQuery] = useState<string>(value || '')
  const [options, setOptions] = useState<AutocompleteOption[]>([])
  const [allOptions, setAllOptions] = useState<AutocompleteOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)

  // Update query when value changes from parent
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '')
    }
  }, [value])

  // Fetch all options for readOnlyInput, or filtered for normal input
  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true)
      try {
        const url = readOnlyInput ? `${apiEndpoint}` : `${apiEndpoint}?q=${encodeURIComponent(query)}`
        const response = await fetch(url)
        const result = await response.json()
        
        // Handle both direct array responses and paginated responses
        const data = Array.isArray(result) ? result : (result.data || [])
        
        setAllOptions(data)

        if (readOnlyInput) {
          if (query.trim() === '') {
            setOptions(data)
          } else {
            const filtered = data.filter(
              (option: AutocompleteOption) =>
                option.codigo && option.nombre && (
                  option.codigo.toLowerCase().includes(query.toLowerCase()) ||
                  option.nombre.toLowerCase().includes(query.toLowerCase())
                )
            )
            setOptions(filtered)
          }
        } else {
          // En modo normal, API ya devuelve filtrado
          setOptions(data)
        }
      } catch (error) {
        console.error("Error fetching options:", error)
        setOptions([])
        setAllOptions([])
      } finally {
        setIsLoading(false)
      }
    }

    if (readOnlyInput) {
      fetchOptions()
    } else {
      const debounceTimer = setTimeout(fetchOptions, 300)
      return () => clearTimeout(debounceTimer)
    }
  }, [query, apiEndpoint, readOnlyInput])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowOptions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnlyInput) return // ignore typing if readonly
    const newValue = e.target.value
    setQuery(newValue)
    setShowOptions(true)
    if (onInputChange) {
      onInputChange(newValue)
    }
  }

  const handleOptionSelect = (option: AutocompleteOption) => {
    setQuery(option.codigo)
    setShowOptions(false)
    // Ensure we're passing the full option with all properties
    onSelect({
      codigo: option.codigo,
      nombre: option.nombre,
      precio_base: option.precio_base,
      tiene_iva: option.tiene_iva
    })
  }

  return (
    <div className="relative space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setShowOptions(true)
            if (readOnlyInput) {
              const filtered = allOptions.filter(
                (option: AutocompleteOption) =>
                  option.codigo.toLowerCase().includes(query.toLowerCase()) ||
                  option.nombre.toLowerCase().includes(query.toLowerCase())
              )
              setOptions(filtered)
            }
          }}
          onClick={() => {
            setShowOptions(true)
            if (readOnlyInput) {
              const filtered = allOptions.filter(
                (option: AutocompleteOption) =>
                  option.codigo.toLowerCase().includes(query.toLowerCase()) ||
                  option.nombre.toLowerCase().includes(query.toLowerCase())
              )
              setOptions(filtered)
            }
          }}
          placeholder={placeholder}
          required={required}
          readOnly={readOnlyInput || disabled}
          disabled={disabled}
          style={readOnlyInput && !disabled ? { cursor: 'pointer', background: '#f3f4f6' } : undefined}
          className={disabled ? 'opacity-70 cursor-not-allowed' : ''}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showOptions && options.length > 0 && (
        <Card ref={optionsRef} className="absolute z-50 w-full max-h-60 overflow-y-auto border shadow-lg">
          <div className="p-1">
            {options.map((option, index) => (
              <div
                key={`${option.codigo}-${index}`}
                className="px-3 py-2 cursor-pointer hover:bg-muted rounded-sm transition-colors"
                onClick={() => handleOptionSelect(option)}
              >
                <div className="font-medium text-sm">{option.codigo}</div>
                <div className="text-xs text-muted-foreground">{option.nombre}</div>
                {option.precio_base !== undefined && (
                  <div className="text-xs text-green-600">
                    ${option.precio_base.toLocaleString("es-CO")} COP
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showOptions && query.length >= 1 && options.length === 0 && !isLoading && (
        <Card ref={optionsRef} className="absolute z-50 w-full border shadow-lg">
          <div className="p-3 text-sm text-muted-foreground text-center">
            No se encontraron resultados para "{query}"
          </div>
        </Card>
      )}
    </div>
  )
}
