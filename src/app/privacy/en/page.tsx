// English version of the privacy policy.
//
// The app ships in Japanese to a Japanese audience, but Google's OAuth
// verification reviewers read English. The first submission came back with
// "your privacy policy does not specify any data protection mechanisms for
// sensitive data" — partly a missing section, partly a policy they could not
// read. Give them the URL of this page.
//
// **Keep this in step with /privacy.** Two policies that disagree are worse
// than one. When the Japanese page changes, change this one in the same commit.

export const metadata = {
  title: "Privacy Policy | Imbrex",
};

const UPDATED = "18 September 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[13px] tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] text-muted-foreground leading-relaxed">{children}</p>
);

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">{children}</ul>
);

export default function PrivacyEnPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-8">
      <div>
        <h1 className="text-[22px] tracking-wide">Privacy Policy</h1>
        <p className="text-[11px] text-muted-foreground mt-1">Last updated: {UPDATED}</p>
        <p className="mt-2">
          <a href="/privacy" className="text-[11px] underline underline-offset-4 text-muted-foreground hover:text-foreground">
            日本語
          </a>
        </p>
      </div>

      <P>
        Imbrex (&quot;the app&quot;) helps one or two people who live together share chores,
        schedules and shopping. This policy describes what the app collects and how it is handled.
      </P>

      <Section title="Information we collect">
        <UL>
          <li>・Account details — the email address and display name from the Google or Apple account used to sign in</li>
          <li>・Content you enter — tasks, chores and their completion records, shopping lists, recipes, meal plans, expense records</li>
          <li>・Google Calendar events — read only, and only if you connect your calendar</li>
          <li>・Approximate location — latitude and longitude, used solely to show the weather</li>
        </UL>
        <P>
          We do not collect payment card details or contacts, and we do not access your photo
          library as a whole. We do not collect advertising identifiers and do not track you for
          advertising purposes.
        </P>
      </Section>

      <Section title="How we use it">
        <P>
          Information is used only to provide the features of the app. It is not used for
          advertising or profiling, and is never sold or transferred to third parties.
        </P>
      </Section>

      <Section title="Sharing within a household">
        <P>
          When someone joins your household with an invite code, that household&apos;s data is
          shared with them. Shopping list items you mark as your own remain visible only to you.
        </P>
        <P>
          Recipes belong to the person who saved them. While you share a household you can see
          each other&apos;s recipes; once the household is dissolved each person keeps only their
          own. Expense records and the shared shopping list only cover the period you are
          currently sharing, so a new partner never sees records from a previous one.
        </P>
      </Section>

      <Section title="Third-party services">
        <UL>
          <li>・<strong>Supabase</strong> — stores your account and everything you save in the app</li>
          <li>・<strong>Google</strong> — sign-in and reading your calendar</li>
          <li>
            ・<strong>Anthropic</strong> — recipe import. Only when you use the import feature, the
            contents of the page you import from, or the photo you choose, are sent for analysis.
            Nothing is sent unless you use it.
          </li>
          <li>
            ・<strong>OpenWeatherMap</strong> — weather. Latitude and longitude are sent when you
            open the home screen. If the device cannot provide a location, an approximate one is
            derived from the connection.
          </li>
        </UL>
      </Section>

      <Section title="Google user data">
        <P>
          Imbrex&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <strong>Google API Services User Data Policy</strong>, including the Limited Use
          requirements.
        </P>
        <P>
          Calendar events are used solely to display them inside the app. They are not used for
          advertising, not sold to third parties, and not read by humans, except where required by
          law, necessary for a security investigation, or with your explicit consent.
        </P>
      </Section>

      <Section title="How we protect your data">
        <P>
          We take the following measures to protect your information, and in particular the
          credentials used to access your Google Calendar.
        </P>
        <UL>
          <li>
            ・<strong>Encryption in transit</strong> — all traffic between your device and our
            servers is encrypted with TLS (HTTPS). Our domain is on the HSTS preload list, so
            unencrypted connections are not possible.
          </li>
          <li>
            ・<strong>Encryption at rest for credentials</strong> — Google OAuth tokens are
            encrypted with AES-256-GCM before being stored. The decryption key is held outside the
            database, so the database contents alone cannot be used to decrypt them.
          </li>
          <li>
            ・<strong>Calendar events are not stored</strong> — events are fetched from Google each
            time they are displayed. They are never written to our database and exist only on the
            device that is showing them.
          </li>
          <li>
            ・<strong>Access control</strong> — the database enforces row-level security, so each
            record is readable only by its owner and the members of their household. OAuth tokens
            are stricter still: <strong>nobody but the owner can read them, not even a member of
            the same household.</strong>
          </li>
          <li>
            ・<strong>Least privilege</strong> — we request read-only calendar access
            (<code className="text-[11px]">calendar.readonly</code>) and nothing more. We do not
            request permission to create, modify or delete events.
          </li>
        </UL>
        <P>
          Data is stored with Supabase and the app is served by Vercel, and their respective
          security measures apply. You can disconnect your calendar at any time from the
          third-party access settings of your Google Account; once revoked, the app can no longer
          read it.
        </P>
      </Section>

      <Section title="Photos">
        <P>
          Photos attached to recipes are stored in Supabase Storage and served to anyone holding
          the URL. URLs are assigned automatically and are hard to guess, but please do not upload
          images you would not want a third party to see.
        </P>
      </Section>

      <Section title="Notifications">
        <P>
          Chore reminders are scheduled and shown by your device. Nothing is sent to a server for
          notifications and no device identifier is stored. You can change whether and when they
          appear from the app&apos;s settings at any time.
        </P>
      </Section>

      <Section title="Payments">
        <P>
          The app currently has no paid features and collects no payment information. If that
          changes, we will update this policy and let you know.
        </P>
      </Section>

      <Section title="Deleting your data">
        <P>
          You can delete your account and the data stored with it from Settings → Delete account.
          If someone else is in your household, you can choose whether to hand the shared data over
          to them. <strong>Deletion cannot be undone.</strong>
        </P>
      </Section>

      <Section title="Contact">
        <P>Questions: imbrex2026@gmail.com</P>
      </Section>
    </main>
  );
}
