---
name: forms
description: Forms knowledge base - react-hook-form, Zod validation, Server Actions, file upload, multi-step forms. Use when building forms, implementing validation, handling file uploads, or creating multi-step form flows.
version: 1.0.0
---

# Forms Skill

Knowledge base per gestione form in applicazioni React/Next.js moderne.

## React Hook Form + Zod (Stack Raccomandato)

### Installazione

```bash
pnpm add react-hook-form zod @hookform/resolvers
```

### Schema Validation con Zod

```typescript
// lib/validations/user.ts
import { z } from 'zod'

// Schema base
export const userSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve avere almeno 2 caratteri')
    .max(50, 'Nome troppo lungo'),
  email: z
    .string()
    .email('Email non valida'),
  password: z
    .string()
    .min(8, 'Password deve avere almeno 8 caratteri')
    .regex(/[A-Z]/, 'Deve contenere almeno una maiuscola')
    .regex(/[a-z]/, 'Deve contenere almeno una minuscola')
    .regex(/[0-9]/, 'Deve contenere almeno un numero'),
  confirmPassword: z.string(),
  age: z
    .number()
    .min(18, 'Devi avere almeno 18 anni')
    .max(120)
    .optional(),
  website: z
    .string()
    .url('URL non valido')
    .optional()
    .or(z.literal('')),
  role: z.enum(['user', 'admin', 'editor'], {
    errorMap: () => ({ message: 'Seleziona un ruolo valido' }),
  }),
  acceptTerms: z
    .boolean()
    .refine(val => val === true, 'Devi accettare i termini'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
})

// Type inference
export type UserFormData = z.infer<typeof userSchema>

// Schema parziale per update
export const updateUserSchema = userSchema
  .omit({ password: true, confirmPassword: true, acceptTerms: true })
  .partial()

export type UpdateUserData = z.infer<typeof updateUserSchema>
```

### Form Component Base

```typescript
// components/forms/user-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema, type UserFormData } from '@/lib/validations/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface UserFormProps {
  onSubmit: (data: UserFormData) => Promise<void>
  defaultValues?: Partial<UserFormData>
}

export function UserForm({ onSubmit, defaultValues }: UserFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      acceptTerms: false,
      ...defaultValues,
    },
  })

  const onFormSubmit = async (data: UserFormData) => {
    try {
      await onSubmit(data)
      reset()
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Text Input */}
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Email Input */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Conferma Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          aria-invalid={!!errors.confirmPassword}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Select con Controller */}
      <div className="space-y-2">
        <Label htmlFor="role">Ruolo</Label>
        <Select
          value={watch('role')}
          onValueChange={(value) => setValue('role', value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona ruolo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Utente</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-sm text-destructive">{errors.role.message}</p>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="acceptTerms"
          checked={watch('acceptTerms')}
          onCheckedChange={(checked) => setValue('acceptTerms', !!checked)}
        />
        <Label htmlFor="acceptTerms" className="text-sm">
          Accetto i termini e condizioni
        </Label>
      </div>
      {errors.acceptTerms && (
        <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Invio in corso...' : 'Registrati'}
      </Button>
    </form>
  )
}
```

### Form con shadcn/ui Form Components

```typescript
// components/forms/contact-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const contactSchema = z.object({
  name: z.string().min(2, 'Nome richiesto'),
  email: z.string().email('Email non valida'),
  subject: z.string().min(5, 'Oggetto troppo corto'),
  message: z.string().min(10, 'Messaggio troppo corto').max(1000),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  })

  async function onSubmit(data: ContactFormData) {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Errore invio')

      toast.success('Messaggio inviato!')
      form.reset()
    } catch (error) {
      toast.error('Errore durante l\'invio')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Mario Rossi" {...field} />
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="mario@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Oggetto</FormLabel>
              <FormControl>
                <Input placeholder="Di cosa vuoi parlare?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Messaggio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Scrivi il tuo messaggio..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Massimo 1000 caratteri
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Invio...' : 'Invia messaggio'}
        </Button>
      </form>
    </Form>
  )
}
```

### Server Actions con Form

```typescript
// app/actions/contact.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
})

export type ContactState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function submitContact(
  prevState: ContactState,
  formData: FormData
): Promise<ContactState> {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  }

  const validatedFields = contactSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: 'Dati non validi',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  try {
    // Save to database or send email
    await saveContact(validatedFields.data)
    
    revalidatePath('/contacts')
    return { success: true }
  } catch (error) {
    return { error: 'Errore durante il salvataggio' }
  }
}
```

```typescript
// components/forms/server-contact-form.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { submitContact, type ContactState } from '@/app/actions/contact'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useEffect } from 'react'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Invio...' : 'Invia'}
    </Button>
  )
}

export function ServerContactForm() {
  const [state, formAction] = useFormState<ContactState, FormData>(
    submitContact,
    {}
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Messaggio inviato!')
    }
    if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Messaggio</Label>
        <Textarea id="message" name="message" required />
        {state.fieldErrors?.message && (
          <p className="text-sm text-destructive">{state.fieldErrors.message[0]}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  )
}
```

### Dynamic Form Fields (Array)

```typescript
// components/forms/order-form.tsx
'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Seleziona prodotto'),
  quantity: z.number().min(1, 'Minimo 1').max(99),
  notes: z.string().optional(),
})

const orderSchema = z.object({
  customerName: z.string().min(2),
  items: z.array(orderItemSchema).min(1, 'Aggiungi almeno un prodotto'),
})

type OrderFormData = z.infer<typeof orderSchema>

export function OrderForm() {
  const { control, register, handleSubmit, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: '',
      items: [{ productId: '', quantity: 1, notes: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const onSubmit = (data: OrderFormData) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label>Nome Cliente</Label>
        <Input {...register('customerName')} />
        {errors.customerName && (
          <p className="text-sm text-destructive">{errors.customerName.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Prodotti</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: '', quantity: 1, notes: '' })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-4 items-start p-4 border rounded">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="ID Prodotto"
                {...register(`items.${index}.productId`)}
              />
              {errors.items?.[index]?.productId && (
                <p className="text-sm text-destructive">
                  {errors.items[index]?.productId?.message}
                </p>
              )}
            </div>

            <div className="w-24 space-y-2">
              <Input
                type="number"
                min={1}
                {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {errors.items?.root && (
          <p className="text-sm text-destructive">{errors.items.root.message}</p>
        )}
      </div>

      <Button type="submit">Invia Ordine</Button>
    </form>
  )
}
```

### File Upload

```typescript
// components/forms/upload-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const uploadSchema = z.object({
  title: z.string().min(1),
  image: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, 'Immagine richiesta')
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      'Max 5MB'
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      'Formato non supportato'
    ),
})

type UploadFormData = z.infer<typeof uploadSchema>

export function UploadForm() {
  const [preview, setPreview] = useState<string | null>(null)
  
  const { register, handleSubmit, formState: { errors } } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  })

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data: UploadFormData) => {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('image', data.image[0])

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Titolo</Label>
        <Input {...register('title')} />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Immagine</Label>
        <Input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          {...register('image', { onChange: onFileChange })}
        />
        {errors.image && (
          <p className="text-sm text-destructive">{errors.image.message as string}</p>
        )}
      </div>

      {preview && (
        <div className="relative w-32 h-32">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover rounded"
          />
        </div>
      )}

      <Button type="submit">Upload</Button>
    </form>
  )
}
```

## Zod Schemas Avanzati

```typescript
// lib/validations/common.ts
import { z } from 'zod'

// Reusable schemas
export const emailSchema = z.string().email('Email non valida')

export const passwordSchema = z
  .string()
  .min(8, 'Minimo 8 caratteri')
  .regex(/[A-Z]/, 'Almeno una maiuscola')
  .regex(/[a-z]/, 'Almeno una minuscola')
  .regex(/[0-9]/, 'Almeno un numero')
  .regex(/[^A-Za-z0-9]/, 'Almeno un carattere speciale')

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,14}$/, 'Numero non valido')

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug non valido')

export const dateSchema = z.coerce.date()

export const priceSchema = z
  .number()
  .positive('Prezzo deve essere positivo')
  .multipleOf(0.01, 'Max 2 decimali')

// Conditional validation
export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  zipCode: z.string(),
}).refine((data) => {
  // ZIP validation based on country
  if (data.country === 'IT') {
    return /^\d{5}$/.test(data.zipCode)
  }
  if (data.country === 'US') {
    return /^\d{5}(-\d{4})?$/.test(data.zipCode)
  }
  return true
}, {
  message: 'CAP non valido per il paese selezionato',
  path: ['zipCode'],
})

// Transform
export const createUserSchema = z.object({
  email: emailSchema.transform((email) => email.toLowerCase().trim()),
  name: z.string().transform((name) => name.trim()),
})

// Discriminated union
export const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    cardNumber: z.string().length(16),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    cvv: z.string().length(3),
  }),
  z.object({
    method: z.literal('paypal'),
    paypalEmail: emailSchema,
  }),
  z.object({
    method: z.literal('bank'),
    iban: z.string().min(15).max(34),
  }),
])
```

## Best Practices

1. **Validation su client E server** - Mai fidarsi solo del client
2. **Schema condivisi** - Usa gli stessi Zod schema su client e server
3. **Error handling** - Mostra errori chiari e specifici
4. **Loading states** - Disabilita submit durante invio
5. **Reset form** - Resetta dopo successo
6. **Accessibility** - `aria-invalid`, `aria-describedby`
7. **Debounce** - Per validazione async (email esistente)

## Checklist Forms

- [ ] Zod schemas definiti
- [ ] React Hook Form configurato
- [ ] Validazione client-side
- [ ] Validazione server-side (Server Actions)
- [ ] Error messages localizzati
- [ ] Loading states durante submit
- [ ] Accessibilità (aria, labels)
- [ ] Form reset dopo successo
- [ ] File upload con preview
- [ ] Dynamic fields se necessario
