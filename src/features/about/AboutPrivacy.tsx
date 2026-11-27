import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { ExternalLink } from '@/components/ui/ExternalLink';

/** Privacy statement (SECURITY.md §6). */
export const PRIVACY_STATEMENT =
  "Breathwise has no accounts and no tracking. Your household details stay in this browser. When you generate a plan, a summary of today's air data and your household details (without exact location) is sent to Google's Gemini API through our server, or directly if you use your own key. Clear everything anytime in Settings.";

/** "About data" sheet (UI_UX.md §3.3): sources, model note, NAQI method, attribution, privacy. */
export function AboutPrivacy({ trigger }: { trigger: ReactNode }) {
  return (
    <Sheet trigger={trigger} title="About & privacy">
      <div className="space-y-6">
        <section aria-labelledby="about-sources" className="space-y-2">
          <h3 id="about-sources" className="text-lg font-semibold">
            Where the data comes from
          </h3>
          <p>
            Air quality:{' '}
            <ExternalLink href="https://open-meteo.com/en/docs/air-quality-api">
              Open-Meteo Air Quality API
            </ExternalLink>
            , using the{' '}
            <ExternalLink href="https://atmosphere.copernicus.eu/">
              Copernicus Atmosphere Monitoring Service (CAMS)
            </ExternalLink>{' '}
            global model. Weather:{' '}
            <ExternalLink href="https://open-meteo.com/">Open-Meteo Forecast API</ExternalLink>.
            Place search: Open-Meteo Geocoding (location data based on{' '}
            <ExternalLink href="https://www.geonames.org/">GeoNames</ExternalLink>). Place names for
            &ldquo;Use my location&rdquo;:{' '}
            <ExternalLink href="https://www.bigdatacloud.com/">BigDataCloud</ExternalLink>.
          </p>
          <p>
            These are <strong>modelled estimates</strong> on a grid of about 45 km, for the nearest
            model grid point. They are not readings from a ground monitoring station, so they can
            differ from your nearest CPCB station. Readings update hourly; data older than 90
            minutes is marked stale.
          </p>
        </section>

        <section aria-labelledby="about-naqi" className="space-y-2">
          <h3 id="about-naqi" className="text-lg font-semibold">
            How India AQI is estimated
          </h3>
          <p>
            Breathwise calculates India&apos;s National AQI with the{' '}
            <ExternalLink href="https://cpcb.gov.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvRklOQUwtUkVQT1JUX0FRSV8ucGRm">
              CPCB method (2014)
            </ExternalLink>
            : 24-hour averages for PM2.5, PM10, NO₂ and SO₂, 8-hour averages for O₃ and CO, the CPCB
            breakpoints, and the worst sub-index as the AQI. It needs at least 3 pollutants
            including PM2.5 or PM10, and 16 hours of data. Because the inputs are modelled, it is
            labelled &ldquo;estimated&rdquo;. The hourly timeline shows PM2.5 levels, not the
            24-hour index.
          </p>
          <p>
            Best times, ventilation times, risk levels and CO₂ figures are calculated by fixed rules
            with cited sources, never by AI. The AI only explains and personalises them.
          </p>
        </section>

        <section aria-labelledby="about-attribution" className="space-y-2">
          <h3 id="about-attribution" className="text-lg font-semibold">
            Attribution
          </h3>
          <p className="text-sm">
            Contains modified Copernicus Atmosphere Monitoring Service information. Weather and
            geocoding data by Open-Meteo.com under{' '}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </ExternalLink>
            .
          </p>
        </section>

        <section aria-labelledby="privacy-heading" className="space-y-2">
          <h3 id="privacy-heading" className="text-lg font-semibold">
            Your privacy
          </h3>
          <p>{PRIVACY_STATEMENT}</p>
          <p className="text-muted">Locations are stored rounded to about 1 km.</p>
        </section>

        <p className="font-medium">General guidance, not medical advice.</p>
      </div>
    </Sheet>
  );
}
