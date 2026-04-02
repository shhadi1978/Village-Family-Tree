# Village Family Tree

منصة لإدارة وتوثيق أنساب العائلات داخل القرية مع عرض شجرة تفاعلية، إدارة الأفراد والعلاقات، وصلاحيات إدارية مرنة.

## Overview

- Next.js 14 (App Router)
- Prisma + PostgreSQL
- Clerk Authentication
- React Flow for tree visualization
- Tailwind CSS + Lucide Icons

## Main Features

- إدارة القرى، العائلات، والأفراد.
- شجرة عائلة تفاعلية مع خيارات عرض:
  - الوالدين
  - الإخوة/الأخوات
  - السلالة
- ترتيب الأفراد حسب:
  - التسلسل
  - الأبجدية
  - السلالة (Lineage)
- إحصائيات سلالة لكل فرد (ذكور/إناث/إجمالي).
- إنشاء المؤسس تلقائيا عند إنشاء العائلة.
- قاعدة أعمال: لكل فرد أب واحد فقط وأم واحدة فقط.
- Dev Role Switcher (بيئة التطوير فقط):
  - SUPER_ADMIN
  - FAMILY_ADMIN
  - VIEWER (مستخدم عادي بدون صلاحيات إضافة/تعديل/حذف)

## Project Structure

- app/: الصفحات وواجهات API
- components/: المكونات الواجهة
- lib/: الخدمات، hooks، قواعد الصلاحيات والمنطق
- prisma/: schema وقاعدة البيانات

## Requirements

- Node.js 18+
- npm 9+
- PostgreSQL database

## Environment Variables

أنشئ ملف .env.local وأضف القيم التالية:

- DATABASE_URL
- DIRECT_URL (اختياري، يفضل مع Neon/Pooling)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- NEXT_PUBLIC_APP_URL
- SUPER_ADMIN_CLERK_IDS
- UPLOADTHING_SECRET
- UPLOADTHING_APP_ID

ملاحظة: لا تضع القيم السرية داخل README أو Git.

## Local Setup

1. Install dependencies:

npm install

2. Generate Prisma client:

npm run prisma:generate

3. Apply database migrations (development):

npm run prisma:migrate

4. Start development server:

npm run dev

5. Open app:

http://localhost:3000

## NPM Scripts

- npm run dev
- npm run build
- npm run start
- npm run lint
- npm run prisma:generate
- npm run prisma:migrate
- npm run prisma:studio

## Authentication and Access

- Dashboard routes are protected.
- Family tree route is currently protected by middleware and requires sign-in.
- Permission checks are enforced in UI and API.

## Deployment (Recommended: Vercel)

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add all environment variables in Vercel Project Settings.
4. Build and deploy.
5. Run Prisma migration in production:

npx prisma migrate deploy

6. Configure Clerk production URLs (redirects and allowed origins).

## Troubleshooting

- Error about missing Prisma columns:
  - Run prisma generate + migrations/db push based on your workflow.
- Relationship duplicate error:
  - The system blocks duplicate links with same fromMemberId + toMemberId + type.
- Father replacement issues:
  - Parent replacement is handled as replace mode, not plain add.

## Notes

- This repository uses strict business rules for lineage consistency.
- For development role testing, use Dev Role Switcher from dashboard header/side panel.
