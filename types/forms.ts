import { ChangeEvent, FormEvent } from 'react';

export type FormEventType = FormEvent<HTMLFormElement>;
export type InputChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  required?: boolean;
  validate?: (value: T) => string | undefined;
}

export type FormFields<T> = {
  [K in keyof T]?: FormField<T[K]>;
} & {
  values: T;
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
};

export interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface FormHandlers {
  handleChange: (e: InputChangeEvent) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e?: FormEventType) => Promise<void>;
  resetForm: () => void;
  setFieldValue: <K extends string>(
    field: K,
    value: unknown,
    shouldValidate?: boolean
  ) => void;
  setFieldTouched: (field: string, isTouched?: boolean, shouldValidate?: boolean) => void;
  setFieldError: (field: string, message: string | undefined) => void;
  setErrors: (errors: Record<string, string>) => void;
  setValues: <V>(values: V) => void;
  setSubmitting: (isSubmitting: boolean) => void;
}
