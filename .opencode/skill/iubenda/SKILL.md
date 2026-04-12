---
name: iubenda
description: Iubenda integration for cookie consent, privacy policy, and GDPR compliance. Use when integrating Iubenda cookie banner, setting up Google Consent Mode v2, or generating privacy documents with Iubenda.
version: 1.0.0
---

# Iubenda Integration Skill

Integrazione Iubenda per gestione compliance cookie e privacy su siti Next.js.

## Cos'è Iubenda

Servizio SaaS per compliance GDPR/ePrivacy che fornisce:
- Cookie Solution (banner + blocco preventivo)
- Privacy/Cookie Policy generator
- Consent Database
- Terms & Conditions generator

## Setup

### 1. Variabili Ambiente

```env
NEXT_PUBLIC_IUBENDA_SITE_ID=<site-id>
NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID=<cookie-policy-id>
# Opzionale: per privacy policy embedded
NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID=<privacy-policy-id>
```

### 2. Cookie Solution (Banner)

```tsx
// components/iubenda/cookie-banner.tsx
'use client';

import Script from 'next/script';

const SITE_ID = process.env.NEXT_PUBLIC_IUBENDA_SITE_ID;
const COOKIE_POLICY_ID = process.env.NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID;

export function IubendaCookieBanner({ locale }: { locale: string }) {
  const langMap: Record<string, string> = {
    it: 'it',
    en: 'en',
    cs: 'cs',
  };

  return (
    <>
      <Script id="iubenda-config" strategy="beforeInteractive">
        {`
          var _iub = _iub || [];
          _iub.csConfiguration = {
            siteId: ${SITE_ID},
            cookiePolicyId: ${COOKIE_POLICY_ID},
            lang: "${langMap[locale] || 'en'}",
            
            // UI Configuration
            banner: {
              acceptButtonDisplay: true,
              closeButtonDisplay: false,
              customizeButtonDisplay: true,
              rejectButtonDisplay: true,
              
              acceptButtonCaption: "${locale === 'it' ? 'Accetta tutti' : 'Accept all'}",
              rejectButtonCaption: "${locale === 'it' ? 'Rifiuta tutti' : 'Reject all'}",
              customizeButtonCaption: "${locale === 'it' ? 'Personalizza' : 'Customize'}",
              
              position: "float-bottom-center",
              backgroundOverlay: true,
              textColor: "#1e293b",
              backgroundColor: "#ffffff",
              acceptButtonColor: "#3b82f6",
              acceptButtonCaptionColor: "#ffffff",
              rejectButtonColor: "#e2e8f0",
              rejectButtonCaptionColor: "#1e293b",
              customizeButtonColor: "#e2e8f0",
              customizeButtonCaptionColor: "#1e293b",
            },

            // Consent Configuration
            consentOnContinuedBrowsing: false,
            perPurposeConsent: true,
            
            // Google Consent Mode v2
            googleConsentMode: "template",
            
            // Purposes
            purposes: "1,4,5",
            // 1 = Necessary
            // 4 = Analytics  
            // 5 = Marketing
            
            // Auto-blocking
            enableAutoBlocking: true,
          };
        `}
      </Script>
      <Script
        src={`https://cs.iubenda.com/autoblocking/${SITE_ID}.js`}
        strategy="beforeInteractive"
      />
      <Script
        src="//cdn.iubenda.com/cs/iubenda_cs.js"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
```

### 3. Privacy Policy Embedded

```tsx
// components/iubenda/privacy-policy.tsx
'use client';

import Script from 'next/script';

export function IubendaPrivacyPolicy() {
  return (
    <>
      <a
        href={`https://www.iubenda.com/privacy-policy/${process.env.NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID}`}
        className="iubenda-white iubenda-noiframe iubenda-embed"
        title="Privacy Policy"
      >
        Privacy Policy
      </a>
      <Script src="https://cdn.iubenda.com/iubenda.js" strategy="lazyOnload" />
    </>
  );
}
```

### 4. Integrazione nel Layout

```tsx
// app/[locale]/layout.tsx
import { IubendaCookieBanner } from '@/components/iubenda/cookie-banner';

export default function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale}>
      <body>
        {children}
        <IubendaCookieBanner locale={locale} />
      </body>
    </html>
  );
}
```

---

## Google Consent Mode v2

Iubenda supporta Google Consent Mode v2 nativamente. Configurazione:

```tsx
// Nel config Iubenda
googleConsentMode: "template",

// Questo gestisce automaticamente:
// - ad_storage
// - analytics_storage
// - ad_user_data
// - ad_personalization
// - functionality_storage
// - personalization_storage
// - security_storage
```

**Obbligatorio dal marzo 2024** per continuare a usare Google Ads e GA4 in UE.

---

## Conditional Script Loading

### Pattern: Carica script SOLO dopo consenso

```tsx
// hooks/use-consent.ts
'use client';

import { useEffect, useState } from 'react';

type ConsentPurpose = 'necessary' | 'analytics' | 'marketing';

export function useConsent(purpose: ConsentPurpose): boolean {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    // Iubenda exposes consent via _iub.cs.consent
    const checkConsent = () => {
      const consent = (window as any)._iub?.cs?.consent;
      if (!consent) return false;
      
      switch (purpose) {
        case 'necessary': return true;
        case 'analytics': return consent.purposes?.['4'] === true;
        case 'marketing': return consent.purposes?.['5'] === true;
        default: return false;
      }
    };

    setHasConsent(checkConsent());

    // Listen for consent changes
    const handler = () => setHasConsent(checkConsent());
    window.addEventListener('_iub_cs_consent_given', handler);
    return () => window.removeEventListener('_iub_cs_consent_given', handler);
  }, [purpose]);

  return hasConsent;
}
```

---

## Prezzi Iubenda

| Piano | Prezzo | Include |
|-------|--------|---------|
| Free | €0 | Cookie banner base, 1 policy |
| Pro | ~€29/anno | Auto-blocking, consent log, multi-lingua |
| Ultra | ~€99/anno | + T&C generator, consent database, internal privacy |

**Raccomandazione**: Piano Pro per siti client standard.

---

## Checklist Integrazione

- [ ] Account Iubenda creato per il client
- [ ] Site ID e Cookie Policy ID configurati
- [ ] Cookie banner multilingua (IT/EN/CZ)
- [ ] Auto-blocking attivo (blocca script pre-consenso)
- [ ] Google Consent Mode v2 attivo
- [ ] Privacy Policy generata e linkata nel footer
- [ ] Cookie Policy generata e linkata nel footer
- [ ] Test: verificare che GA4/GTM NON si carichino prima del consenso
- [ ] Test: verificare che il rifiuto funzioni correttamente
- [ ] Link "Gestisci Cookie" nel footer per revocare consenso
