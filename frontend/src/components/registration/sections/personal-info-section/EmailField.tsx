import { useEffect, useMemo, useRef, useState } from 'react'
import {
  composeEmail,
  getEmailValidationMessage,
  normalizeEmailParts,
  splitEmailParts,
} from '../../../../utils/email'

type EmailFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  readOnly?: boolean
  title?: string
}

export function EmailField({ id, label, value, onChange, required = false, readOnly = false, title }: EmailFieldProps) {
  const domainInputRef = useRef<HTMLInputElement | null>(null)
  const [hasBlurred, setHasBlurred] = useState(false)
  const { localPart: initialLocalPart, domainPart: initialDomainPart } = useMemo(
    () => splitEmailParts(value),
    [value],
  )

  const [localPart, setLocalPart] = useState(initialLocalPart)
  const [domainPart, setDomainPart] = useState(initialDomainPart)

  useEffect(() => {
    const { localPart: nextLocalPart, domainPart: nextDomainPart } = splitEmailParts(value)
    setLocalPart(nextLocalPart)
    setDomainPart(nextDomainPart)
  }, [value])

  const syncValue = (nextLocalPart: string, nextDomainPart: string) => {
    onChange(composeEmail(nextLocalPart, nextDomainPart))
  }

  const applyNormalizedParts = (nextLocalPart: string, nextDomainPart: string) => {
    const normalized = normalizeEmailParts(nextLocalPart, nextDomainPart)
    setLocalPart(normalized.localPart)
    setDomainPart(normalized.domainPart)
    syncValue(normalized.localPart, normalized.domainPart)
  }

  const handleLocalPartChange = (nextRawValue: string) => {
    if (nextRawValue.includes('@')) {
      const [rawLocal = '', ...rest] = nextRawValue.split('@')
      const appendedDomain = rest.join('@')
      const nextDomainPart = `${appendedDomain}${domainPart}`

      setLocalPart(rawLocal)
      setDomainPart(nextDomainPart)
      syncValue(rawLocal, nextDomainPart)

      requestAnimationFrame(() => {
        domainInputRef.current?.focus()
        if (domainInputRef.current) {
          const end = domainInputRef.current.value.length
          domainInputRef.current.setSelectionRange(end, end)
        }
      })
      return
    }

    setLocalPart(nextRawValue)
    syncValue(nextRawValue, domainPart)
  }

  const handleDomainPartChange = (nextRawValue: string) => {
    if (nextRawValue.includes('@')) {
      const { localPart: pastedLocal, domainPart: pastedDomain } = splitEmailParts(nextRawValue)
      const nextLocalPart = pastedLocal || localPart
      const nextDomainPart = pastedDomain.replaceAll('@', '')

      setLocalPart(nextLocalPart)
      setDomainPart(nextDomainPart)
      syncValue(nextLocalPart, nextDomainPart)
      return
    }

    const sanitizedDomain = nextRawValue.replaceAll('@', '')
    setDomainPart(sanitizedDomain)
    syncValue(localPart, sanitizedDomain)
  }

  const handleLocalPartKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== '@') {
      return
    }

    event.preventDefault()
    requestAnimationFrame(() => {
      domainInputRef.current?.focus()
    })
  }

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null
    const isMovingWithinField = relatedTarget?.closest('[data-email-field]') === event.currentTarget
    if (!isMovingWithinField) {
      setHasBlurred(true)
      applyNormalizedParts(localPart, domainPart)
    }
  }

  const trimmedValue = value.trim()
  const validationMessage = getEmailValidationMessage(trimmedValue)
  const showError = hasBlurred && validationMessage !== null
  const showPreview = trimmedValue.length > 0

  return (
    <label htmlFor={`${id}-local`} className="flex min-w-0 flex-col gap-2 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <span className="mr-1 font-bold text-red-600" aria-hidden="true">*</span>}
      </span>
      <div
        data-email-field
        onBlur={handleBlur}
        className={`grid min-w-0 grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] items-stretch overflow-hidden rounded-xl border bg-white focus-within:ring-2 ${
          showError
            ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
            : 'border-slate-300 focus-within:border-teal-500 focus-within:ring-teal-100'
        }`}
        dir="ltr"
      >
        <input
          id={`${id}-local`}
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          placeholder="name"
          value={localPart}
          onChange={(event) => handleLocalPartChange(event.target.value)}
          onKeyDown={handleLocalPartKeyDown}
          readOnly={readOnly}
          title={title}
          className={`h-11 w-full min-w-0 border-0 bg-transparent px-3 text-left text-sm outline-none placeholder:text-slate-400 ${
            readOnly ? 'text-slate-500 cursor-not-allowed' : 'text-slate-900'
          }`}
          dir="ltr"
        />
        <div className="flex h-11 w-12 items-center justify-center border-x border-slate-300 bg-slate-50 text-base font-bold text-slate-700" aria-hidden="true" title={title}>
          @
        </div>
        <input
          id={`${id}-domain`}
          ref={domainInputRef}
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          placeholder="gmail.com"
          value={domainPart}
          onChange={(event) => handleDomainPartChange(event.target.value)}
          readOnly={readOnly}
          title={title}
          className={`h-11 w-full min-w-0 border-0 bg-transparent px-3 text-left text-sm outline-none placeholder:text-slate-400 ${
            readOnly ? 'text-slate-500 cursor-not-allowed' : 'text-slate-900'
          }`}
          dir="ltr"
        />
      </div>
      {showPreview ? (
        <p className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
          البريد الكامل: <span className="font-mono">{trimmedValue}</span>
        </p>
      ) : null}
    </label>
  )
}
