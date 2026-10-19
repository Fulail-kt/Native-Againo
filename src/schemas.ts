import { z } from 'zod';

const name = z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long');
const password = z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password is too long');
const email = z.email('Enter a valid email');
const phoneRequired = z
  .string()
  .regex(/^\d+$/, 'Numbers only')
  .min(10, '10 digits minimum')
  .max(15, 'Too long');
const phoneOptional = z
  .string()
  .regex(/^\d*$/, 'Numbers only')
  .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 15), '10–15 digits');

function intText(min: number, max: number, msg: string) {
  return z.string().refine((v) => {
    if (!/^\d+$/.test(v)) return false;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max;
  }, msg);
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(6, 'Enter your email or phone')
    .refine((v) => {
      if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      return /^\d{10,15}$/.test(v);
    }, 'Enter a valid email or 10–15 digit phone'),
  password,
});

export const ownerRegisterSchema = z.object({
  email,
  password,
  name,
});

export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter a company name').max(80, 'Company name is too long'),
  kind: z.enum(['GYM', 'BARBER']),
});

export const gymSettingsSchema = z.object({
  lat: z
    .number()
    .nullable()
    .refine((v) => v != null, { message: 'Drop a pin on the map' }),
  lng: z
    .number()
    .nullable()
    .refine((v) => v != null, { message: 'Drop a pin on the map' }),
  radius: intText(25, 5000, '25–5000 m'),
  openDays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one open day'),
});

export const addMemberSchema = z.object({
  name,
  email,
  password,
});

export const addExerciseSchema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(80, 'Too long'),
  muscle: z.string().min(1),
  sets: intText(1, 50, '1–50'),
  reps: intText(1, 100, '1–100'),
  rest: intText(0, 600, '0–600'),
  how: z.string().max(2000, 'Too long').optional(),
});

export const announcementSchema = z.object({
  message: z.string().trim().min(3, 'Message too short').max(2000, 'Max 2000 characters'),
});

export const shopSettingsSchema = z
  .object({
    name: z.string().trim().min(2, 'Name too short').max(80, 'Too long'),
    phone: phoneOptional,
    mapsUrl: z
      .string()
      .trim()
      .max(500, 'Too long')
      .refine((v) => !v || /^(https?:\/\/|maps\.app\.goo\.gl\/)/i.test(v), 'Paste a Maps link'),
    followUpDays: z.number().int().min(1).max(365),
    openHour: z.number().int().min(6).max(16),
    closeHour: z.number().int().min(7).max(23),
    closedWeekdays: z.array(z.number().int().min(0).max(6)).max(6),
  })
  .refine((v) => v.closeHour > v.openHour, { message: 'Close must be after open', path: ['closeHour'] });

export const addClientSchema = z.object({
  name,
  phone: phoneRequired,
  sendWelcome: z.boolean(),
  followUpDays: z.number().int().min(1).max(365),
  preferredChairId: z.number().int().nullable(),
});

export const shopServiceSchema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(80, 'Too long'),
  mins: intText(5, 240, '5–240 min'),
  price: z.string().refine((v) => {
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 999999;
  }, '0–999999, no minus'),
});

export const clientDetailsSchema = z.object({
  name,
  phone: phoneRequired,
  notes: z.string().max(500, 'Too long'),
  followUpDays: z.number().int().min(1).max(365),
  preferredChairId: z.number().int().nullable(),
});

export const waTestSchema = z.object({
  phone: phoneRequired,
});

export const chairSchema = z
  .object({
    id: z.number().nullable(),
    name: z.string().trim().min(1, 'Name required').max(40, 'Too long'),
    assignStaff: z.boolean(),
    staffName: z.string(),
    staffPhone: z.string(),
    staffPassword: z.string().max(72, 'Too long'),
    hasStaff: z.boolean(),
    canAdmin: z.boolean(),
    isOwner: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.assignStaff || v.isOwner) return;
    if (v.staffName.trim().length < 2) {
      ctx.addIssue({ code: 'custom', path: ['staffName'], message: 'Name too short' });
    }
    if (!/^\d{10,15}$/.test(v.staffPhone)) {
      ctx.addIssue({ code: 'custom', path: ['staffPhone'], message: '10–15 digits' });
    }
    if (!v.hasStaff && v.staffPassword.length < 6) {
      ctx.addIssue({ code: 'custom', path: ['staffPassword'], message: 'Min 6 characters' });
    }
    if (v.hasStaff && v.staffPassword.length > 0 && v.staffPassword.length < 6) {
      ctx.addIssue({ code: 'custom', path: ['staffPassword'], message: 'Min 6 characters' });
    }
  });

export const logSetsSchema = z.object({
  sets: z.array(
    z.object({
      n: z.number().int(),
      weight: z.string().refine(
        (v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0 && Number(v) <= 2000),
        '0–2000',
      ),
      reps: intText(1, 100, '1–100'),
    }),
  ),
});

export const programmeSchema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(80, 'Too long'),
  mode: z.enum(['FIXED', 'REPEAT']),
  nextProgrammeId: z.number().nullable(),
  days: z
    .array(
      z.object({
        key: z.string(),
        name: z.string().max(40, 'Too long'),
        exercises: z
          .array(
            z.object({
              key: z.string(),
              exerciseId: z.number(),
              name: z.string(),
              sets: intText(1, 50, '1–50'),
              reps: intText(1, 100, '1–100'),
              rest: intText(0, 600, '0–600'),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type OwnerRegisterValues = z.infer<typeof ownerRegisterSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type OnboardingValues = z.infer<typeof onboardingSchema>;
export type GymSettingsFormValues = {
  lat: number | null;
  lng: number | null;
  radius: string;
  openDays: number[];
};
export type GymSettingsValues = z.output<typeof gymSettingsSchema>;
export type AddMemberValues = z.infer<typeof addMemberSchema>;
export type AddExerciseValues = z.infer<typeof addExerciseSchema>;
export type AnnouncementValues = z.infer<typeof announcementSchema>;
export type ShopSettingsValues = z.infer<typeof shopSettingsSchema>;
export type AddClientValues = z.infer<typeof addClientSchema>;
export type ShopServiceValues = z.infer<typeof shopServiceSchema>;
export type ClientDetailsValues = z.infer<typeof clientDetailsSchema>;
export type WaTestValues = z.infer<typeof waTestSchema>;
export type ChairValues = z.infer<typeof chairSchema>;
export type LogSetsValues = z.infer<typeof logSetsSchema>;
export type ProgrammeValues = z.infer<typeof programmeSchema>;
