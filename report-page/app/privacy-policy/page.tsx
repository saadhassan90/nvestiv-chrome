import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Nvestiv Intelligence Chrome Extension',
  description: 'Privacy policy for the Nvestiv Intelligence Chrome Extension',
};

export default function PrivacyPolicyPage() {
  const effectiveDate = 'February 13, 2026';
  const lastUpdated = 'February 13, 2026';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white text-lg font-bold">N</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Nvestiv Intelligence</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Chrome Extension Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">
            Effective Date: {effectiveDate} · Last Updated: {lastUpdated}
          </p>
        </header>

        <article className="prose prose-gray prose-sm max-w-none [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-4 [&_li]:text-gray-700 [&_li]:leading-relaxed [&_ul]:mb-4 [&_ol]:mb-4">

          <p>
            This Privacy Policy describes how Nvestiv Capital Corporation (&ldquo;Nvestiv,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            collects, uses, and protects information when you use the Nvestiv Intelligence Chrome Extension
            (the &ldquo;Extension&rdquo;). This policy is supplemental to and consistent with the
            {' '}<a href="https://www.nvestiv.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Nvestiv Privacy Policy</a>{' '}
            governing our platform and services.
          </p>

          <p>
            <strong>Nvestiv Capital Corporation</strong><br />
            80 Atlantic Ave, 4th Floor<br />
            Toronto, Ontario, Canada M6K 1X9<br />
            Data Protection Officer: Saad Hassan
          </p>

          <h2>1. Overview of the Extension</h2>
          <p>
            The Nvestiv Intelligence Chrome Extension is a productivity tool designed for alternative investment
            professionals. It integrates with LinkedIn to extract publicly visible profile information and
            generates AI-powered intelligence reports to support due diligence and investment research workflows.
          </p>

          <h2>2. Information We Collect</h2>

          <h3>2.1 Information You Provide</h3>
          <ul>
            <li>
              <strong>Account Credentials:</strong> When you sign in to the Extension, your authentication
              token is stored locally in your browser using Chrome&apos;s storage API. We do not store your
              password in the Extension.
            </li>
          </ul>

          <h3>2.2 Information Collected Automatically</h3>
          <ul>
            <li>
              <strong>LinkedIn Profile Data:</strong> When you visit a LinkedIn profile or company page, the
              Extension extracts publicly visible information from the page you are viewing. This includes names,
              job titles, company names, work history, education, skills, profile photos, and other information
              displayed on the LinkedIn page. This data is only collected from pages you actively visit while
              signed in to the Extension.
            </li>
            <li>
              <strong>Page Navigation Events:</strong> The Extension detects when you navigate to or away from
              LinkedIn profile and company pages to determine when to activate its functionality. We do not track
              your browsing history on any other websites.
            </li>
          </ul>

          <h3>2.3 Information We Do Not Collect</h3>
          <ul>
            <li>We do not collect browsing history outside of LinkedIn.</li>
            <li>We do not access your LinkedIn credentials or session cookies.</li>
            <li>We do not read your LinkedIn messages, connections list, or feed content.</li>
            <li>We do not collect any data from websites other than LinkedIn profile and company pages.</li>
            <li>We do not collect personally identifiable financial information (bank accounts, credit cards).</li>
            <li>We do not sell personal information to third parties.</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information collected through the Extension for the following purposes:</p>
          <ul>
            <li>
              <strong>Intelligence Report Generation:</strong> Extracted LinkedIn profile data is sent to our
              secure servers where it is combined with publicly available web information to generate intelligence
              reports. This process uses artificial intelligence systems strictly for inference — generating the
              outputs you request.
            </li>
            <li>
              <strong>Entity Management:</strong> Profile data is stored in our database to maintain records of
              contacts and companies you have researched, enabling report refresh and CRM integration.
            </li>
            <li>
              <strong>Service Improvement:</strong> Aggregated, non-personally-identifiable usage patterns may
              be used to improve the quality and performance of our services.
            </li>
          </ul>

          <h2>4. Data Storage and Security</h2>

          <h3>4.1 Local Storage</h3>
          <p>
            The Extension stores the following data locally in your browser using the Chrome Storage API:
          </p>
          <ul>
            <li>Authentication token and expiration timestamp</li>
            <li>User and organization identifiers</li>
            <li>Active report generation job status</li>
          </ul>
          <p>
            This data remains on your device and is cleared when you sign out of the Extension or
            remove the Extension from Chrome.
          </p>

          <h3>4.2 Server-Side Storage</h3>
          <p>
            Extracted profile data and generated intelligence reports are stored on secure servers
            managed by Supabase (our database provider) with industry-standard encryption at rest and
            in transit. We employ administrative, technical, and physical safeguards to protect your
            information.
          </p>

          <h3>4.3 Data Transmission</h3>
          <p>
            All data transmitted between the Extension and our servers is encrypted using TLS 1.2 or higher.
            Data is only transmitted when you are authenticated and actively using the Extension.
          </p>

          <h2>5. Third-Party Services</h2>
          <p>The Extension integrates with the following third-party services for report generation:</p>
          <ul>
            <li>
              <strong>OpenAI:</strong> AI model provider used to synthesize intelligence reports from collected
              web research. Profile data and publicly available web content are processed through OpenAI&apos;s API.
              OpenAI&apos;s data usage is governed by their{' '}
              <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">privacy policy</a>.
            </li>
            <li>
              <strong>Jina AI:</strong> Web search and content retrieval service used to gather publicly available
              information for intelligence reports. Jina AI&apos;s data usage is governed by their privacy policy.
            </li>
            <li>
              <strong>Supabase:</strong> Database and authentication infrastructure provider. Supabase&apos;s data
              handling is governed by their{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">privacy policy</a>.
            </li>
          </ul>
          <p>
            We do not sell, rent, or trade your personal information to any third party. Information shared
            with third-party services is limited to what is necessary to provide the Extension&apos;s functionality.
          </p>

          <h2>6. Chrome Extension Permissions</h2>
          <p>The Extension requests the following Chrome permissions, each for a specific purpose:</p>
          <ul>
            <li>
              <strong>storage:</strong> To store your authentication token and Extension preferences locally
              in your browser.
            </li>
            <li>
              <strong>sidePanel:</strong> To display the Extension&apos;s interface as a side panel alongside
              your browser content.
            </li>
            <li>
              <strong>tabs:</strong> To detect when you navigate to LinkedIn pages and to open intelligence
              reports in new tabs.
            </li>
            <li>
              <strong>notifications:</strong> To notify you when report generation completes or when data
              is synced to your CRM.
            </li>
            <li>
              <strong>alarms:</strong> To periodically check the status of report generation jobs in progress.
            </li>
            <li>
              <strong>Host access to linkedin.com:</strong> To read publicly visible profile and company
              information from LinkedIn pages you visit. The Extension does not modify LinkedIn pages or
              access private LinkedIn data.
            </li>
          </ul>

          <h2>7. Data Retention</h2>
          <p>
            Extracted profile data and generated intelligence reports may be retained indefinitely in our
            systems to provide ongoing service functionality, including report refresh capabilities and
            historical comparison. You may request deletion of your data by contacting our Data Protection
            Officer.
          </p>
          <p>
            Local Extension data (authentication tokens, job status) is automatically cleared when you
            sign out or remove the Extension.
          </p>

          <h2>8. Your Rights and Choices</h2>
          <ul>
            <li>
              <strong>Access and Deletion:</strong> You may request access to or deletion of your personal
              data by contacting us at the address above.
            </li>
            <li>
              <strong>Sign Out:</strong> You can sign out of the Extension at any time, which clears all
              locally stored data.
            </li>
            <li>
              <strong>Uninstall:</strong> Removing the Extension from Chrome removes all locally stored
              data immediately.
            </li>
            <li>
              <strong>Opt Out:</strong> You may stop using the Extension at any time. The Extension only
              processes data on LinkedIn pages you actively visit while signed in.
            </li>
          </ul>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            The Extension is designed for investment professionals and is not directed to children under
            the age of 16. We do not knowingly collect personal information from children under 16. If we
            become aware that we have collected information from a child under 16, we will take steps to
            delete it promptly.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes become effective when posted.
            Continued use of the Extension after changes are posted constitutes acceptance of the modified
            policy. We encourage you to review this page periodically.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, please contact:
          </p>
          <p>
            <strong>Nvestiv Capital Corporation</strong><br />
            Attn: Data Protection Officer<br />
            80 Atlantic Ave, 4th Floor<br />
            Toronto, Ontario, Canada M6K 1X9<br />
            Email: privacy@nvestiv.com
          </p>

        </article>

        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>&copy; {new Date().getFullYear()} Nvestiv Capital Corporation. All rights reserved.</span>
            <a href="https://www.nvestiv.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
              nvestiv.com
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
