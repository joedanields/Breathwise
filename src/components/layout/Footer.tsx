import { ExternalLink } from '@/components/ui/ExternalLink';

/** Data attribution (DATA_SOURCES.md §6) and disclaimer, shown on every screen. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface text-sm text-muted">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6">
        <p>
          Air quality: <ExternalLink href="https://open-meteo.com/">Open-Meteo.com</ExternalLink>,
          using{' '}
          <ExternalLink href="https://atmosphere.copernicus.eu/">
            Copernicus Atmosphere Monitoring Service (CAMS)
          </ExternalLink>{' '}
          data. Contains modified Copernicus Atmosphere Monitoring Service information.
        </p>
        <p>
          Weather &amp; geocoding:{' '}
          <ExternalLink href="https://open-meteo.com/">Open-Meteo.com</ExternalLink> (
          <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</ExternalLink>
          ). Location data based on{' '}
          <ExternalLink href="https://www.geonames.org/">GeoNames</ExternalLink>. Reverse geocoding:{' '}
          <ExternalLink href="https://www.bigdatacloud.com/">BigDataCloud</ExternalLink>.
        </p>
        <p>
          India AQI is calculated by Breathwise from modelled concentrations using{' '}
          <ExternalLink href="https://cpcb.nic.in/">CPCB</ExternalLink> breakpoints.
        </p>
        <p className="font-medium text-text">General guidance, not medical advice.</p>
      </div>
    </footer>
  );
}
